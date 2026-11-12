// vibe-check 공용 로직: 값 검증, 주소 인코딩, 파생값 계산. 브라우저와 Node(테스트) 양쪽에서 쓴다.

const FORMAT_VERSION = '1';

class ReceiptError extends Error {
  constructor(key, ...args) { super(key); this.key = key; this.args = args; }
}

function fromB64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), ch => ch.charCodeAt(0));
}

function toB64url(bytes) {
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function pipe(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

async function checkOf(raw) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', raw));
  return [...h].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 8).toUpperCase();
}

const REQUIRED = ['n', 'p', 's', 'pj', 'fp', 'bd', 'bh', 'q', 'd', 'mc', 'h', 'w', 'tc', 'al', 'ss', 'hs', 'ps', 'sl',
  'ls', 'mp', 'btw', 'rw', 'co', 'pf', 'pm'];
const LENGTHS = { bd: 2, bh: 2, q: 3, mc: 12, h: 24, w: 7, co: 2, pf: 2, pm: 12 };
const NUMBERS = ['p', 's', 'pj', 'tc', 'al', 'ss', 'hs', 'ps', 'sl', 'ls', 'mp', 'btw', 'rw'];
const STAMP = /^\d{4}-\d\d-\d\d \d\d:\d\d$/;
const MAX_HANDOFF = 20000;      // 넘겨받는 값의 길이 상한 (정상 값은 2,000자 안팎)

// 영수증 글꼴이 그릴 수 있는 글자: ASCII, 한글 음절, 한글 자모
const PRINTABLE = /^[\x20-\x7E가-힣ㄱ-ㅣ]+$/;

const isNum = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isStr = (v, max) => typeof v === 'string' && [...v].length <= max;
// [[문자열, 숫자], ...] 형태의 목록. 남이 만든 주소를 열 때 영수증이 끝없이 길어지지 않게 개수와 길이를 막는다
const isList = (v, maxRows, maxLen) => Array.isArray(v) && v.length <= maxRows
  && v.every(r => Array.isArray(r) && r.length === 2 && isStr(r[0], maxLen) && isNum(r[1]));

function validate(d) {
  const bad = k => new ReceiptError('eInvalid', k);
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new ReceiptError('eObject');
  if (String(d.v) !== FORMAT_VERSION) throw new ReceiptError('eVersion', d.v);
  const missing = REQUIRED.filter(k => d[k] === undefined || d[k] === null);
  if (missing.length) throw new ReceiptError('eMissing', missing.join(', '));
  for (const [k, n] of Object.entries(LENGTHS))
    if (!Array.isArray(d[k]) || d[k].length !== n) throw new ReceiptError('eArray', k, n);
  if (typeof d.d !== 'string' || !/^[0-4]{365,366}$/.test(d.d)) throw new ReceiptError('eGrid');
  if (typeof d.n !== 'string' || !d.n.trim() || [...d.n].length > 20 || !PRINTABLE.test(d.n)) throw new ReceiptError('eNick');
  if (typeof d.fp !== 'string' || !STAMP.test(d.fp)) throw bad('fp');
  for (const k of NUMBERS) if (!isNum(d[k])) throw bad(k);
  if (d.p < 1) throw bad('p');
  for (const k of ['q', 'h', 'w', 'co', 'pf']) if (!d[k].every(isNum)) throw bad(k);
  for (const k of ['mc', 'pm']) if (!d[k].every(v => v === null || isNum(v))) throw bad(k);
  for (const k of ['bd', 'bh']) if (!isNum(d[k][0]) || !isStr(d[k][1], 16)) throw bad(k);
  if (d.ld != null && !(Array.isArray(d.ld) && d.ld.length === 2 && d.ld.every(v => isStr(v, 8)))) throw bad('ld');
  if (d.ph != null && !(isList(d.ph, 5, 12) && d.ph.every(r => PRINTABLE.test(r[0])))) throw bad('ph');
  if (d.sc != null && !isList(d.sc, 5, 40)) throw bad('sc');
  if (d.mo != null && !isList(d.mo, 30, 80)) throw bad('mo');
}

// 에이전트가 넘긴 값: #j=<base64url JSON>
function parseHandoff(hash) {
  if (hash.length > MAX_HANDOFF) throw new ReceiptError('eInvalid', 'j');
  let data;
  try {
    data = JSON.parse(new TextDecoder().decode(fromB64url(hash.slice(3).replace(/=+$/, ''))));
  } catch (e) {
    throw new ReceiptError('eIngest');
  }
  validate(data);
  return data;
}

// 발행 시각은 페이지가 찍는다. 이후에는 주소에 고정된다
function stamp(data, now) {
  const two = n => String(n).padStart(2, '0');
  data.iss = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())} ${two(now.getHours())}:${two(now.getMinutes())}`;
  return data;
}

// 정식 주소: #<버전>.<검증 번호>.<raw deflate + base64url>. 검증 번호 = sha256(JSON 바이트) 앞 8자리
async function encode(data) {
  const raw = new TextEncoder().encode(JSON.stringify(data));
  const packed = await pipe(raw, new CompressionStream('deflate-raw'));
  const check = await checkOf(raw);
  return { hash: `#${FORMAT_VERSION}.${check}.${toB64url(packed)}`, check };
}

async function decode(hash) {
  const m = /^#(\d+)\.([0-9A-F]{8})\.([A-Za-z0-9_-]+)$/.exec(hash);
  if (!m || hash.length > MAX_HANDOFF) throw new ReceiptError('eFormat');
  if (m[1] !== FORMAT_VERSION) throw new ReceiptError('eVersion', m[1]);
  let raw, data;
  try {
    raw = await pipe(fromB64url(m[3]), new DecompressionStream('deflate-raw'));
    data = JSON.parse(new TextDecoder().decode(raw));
  } catch (e) {
    throw new ReceiptError('eUnpack');
  }
  validate(data);
  if (typeof data.iss !== 'string' || !STAMP.test(data.iss)) throw new ReceiptError('eInvalid', 'iss');
  return { data, check: m[2], ok: (await checkOf(raw)) === m[2] };
}

// 넘겨받은 값에서 나머지를 계산한다. 같은 데이터면 항상 같은 결과.
function modelName(id) {
  id = String(id);
  // Bedrock, Vertex 등은 앞뒤에 다른 글자가 붙는다 (us.anthropic.claude-opus-4-8-v1:0, claude-opus-4-8@20260101)
  let m = /claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?!\d)/.exec(id);
  if (m) return m[1][0].toUpperCase() + m[1].slice(1) + ' ' + m[2] + (m[3] ? '.' + m[3] : '');
  m = /claude-(\d+)(?:-(\d))?-([a-z]+)/.exec(id);
  if (m) return m[3][0].toUpperCase() + m[3].slice(1) + ' ' + m[1] + (m[2] ? '.' + m[2] : '');
  return id.slice(0, 10);   // 이름 칸 폭(10자)에 맞춘다
}

function derive(d) {
  const pct = (a, b) => (b ? Math.round(a / b * 1000) / 10 : 0);
  const sum = a => a.reduce((x, y) => x + y, 0);
  const y = +d.fp.slice(0, 4);
  const jan1 = Date.UTC(y, 0, 1);
  const idx = iso => Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - jan1) / 864e5);
  const md = i => new Date(jan1 + i * 864e5).toISOString().slice(5, 10);
  const iso = i => new Date(jan1 + i * 864e5).toISOString().slice(0, 10);
  const first = idx(d.fp);
  const end = Math.max(first, Math.min(idx(d.iss), d.d.length - 1));
  const active = [];
  for (let i = first; i <= end; i++) if (d.d[i] !== '0') active.push(i);
  let st = [1, first, first], gp = null, run = 1, runStart = active[0] ?? first;
  for (let k = 1; k < active.length; k++) {
    const gap = active[k] - active[k - 1];
    if (gap === 1) run++;
    else {
      run = 1; runStart = active[k];
      if (!gp || gap - 1 > gp[0]) gp = [gap - 1, active[k - 1] + 1, active[k] - 1];
    }
    if (run > st[0]) st = [run, runStart, active[k]];
  }
  const ad = active.length || 1;
  const months = d.pm.map((v, i) => [i + 1, v, d.mc[i]]).filter(m => m[1] !== null && m[2] >= 50);
  const pickMonth = sign => months.reduce((b, m) => (!b || sign * (m[1] - b[1]) > 0 || (m[1] === b[1] && m[2] > b[2]) ? m : b), null);
  let mo = null;
  if (Array.isArray(d.mo) && d.mo.length) {
    const by = {};
    for (const [id, n] of d.mo) by[modelName(id)] = (by[modelName(id)] || 0) + n;
    const rows = Object.entries(by).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    const total = sum(rows.map(r => r[1]));
    const s = rows.slice(0, 4).map(([k, n]) => [k, pct(n, total)]);
    const rest = pct(sum(rows.slice(4).map(r => r[1])), total);
    if (rest >= 0.1) s.push(['Other', rest]);
    if (total) mo = { d: 30, r: total, s };
  }
  const wm = pickMonth(1), cm = pickMonth(-1);
  return {
    ...d, y, f: iso(first), e: iso(end), ad,
    ar: pct(ad, end - first + 1), pd: Math.round(d.p / ad), pss: Math.round(d.p / (d.s || 1) * 10) / 10,
    st: [st[0], md(st[1]), md(st[2])], gp: gp && [gp[0], md(gp[1]), md(gp[2])],
    ns: pct(sum(d.h.slice(0, 6)), d.p), mrs: pct(sum(d.h.slice(6, 9)), d.p), ws: pct(d.w[5] + d.w[6], d.p),
    wm: wm && [wm[0], wm[1]], cm: cm && [cm[0], cm[1]], mo,
  };
}

if (typeof module !== 'undefined') {
  module.exports = { FORMAT_VERSION, ReceiptError, validate, parseHandoff, stamp, encode, decode, modelName, derive };
}
