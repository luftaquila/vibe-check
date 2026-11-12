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

async function pipe(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

async function checkOf(raw) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', raw));
  return [...h].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 8).toUpperCase();
}

const REQUIRED = ['n', 'p', 's', 'pj', 'fp', 'bd', 'bh', 'q', 'mc', 'h', 'w', 'tc', 'al', 'ss', 'hs', 'ls', 'mp'];
const PATIENCE = ['co', 'pf', 'pm'];      // 인내심 지표. 숨기면(hp) 주소에 담지 않는다
const LENGTHS = { bd: 2, bh: 2, q: 3, mc: 12, h: 24, w: 7 };
const COUNTS = ['p', 's', 'pj', 'tc', 'al', 'ls', 'mp'];
const SHARES = ['ss', 'hs'];
const OPTIONAL_COUNTS = ['btw', 'rw'];
const OPTIONAL_SHARES = ['ps'];      // 도구에 따라 없는 값 (Codex에는 붙여넣기 표시와 슬래시 명령 기록이 없다)
const TOOLS = ['claude-code', 'codex'];
const STAMP = /^2\d{3}-\d\d-\d\d \d\d:\d\d$/;
const MD = /^\d\d-\d\d$/, HM = /^\d\d:\d\d$/, MDHM = /^\d\d-\d\d \d\d:\d\d$/;
const MAX_HANDOFF = 20000;      // 넘겨받는 값의 길이 상한 (정상 값은 2,000자 안팎)

// 영수증 글꼴이 그릴 수 있는 글자: ASCII, 한글 음절, 한글 자모
const PRINTABLE = /^[\x20-\x7E가-힣ㄱ-ㅣ]+$/;

const isNum = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isInt = v => Number.isSafeInteger(v) && v >= 0;
const isStr = (v, max) => typeof v === 'string' && [...v].length <= max;
// [[문자열, 숫자], ...] 형태의 목록. 남이 만든 주소를 열 때 영수증이 끝없이 길어지지 않게 개수와 길이를 막는다
const isList = (v, maxRows, maxLen) => Array.isArray(v) && v.length <= maxRows
  && v.every(r => Array.isArray(r) && r.length === 2 && isStr(r[0], maxLen) && isInt(r[1]));
const two = n => String(n).padStart(2, '0');
const pct = (a, b) => (b ? Math.round(a / b * 1000) / 10 : 0);      // 소수 한 자리 퍼센트

function validate(d) {
  const bad = k => new ReceiptError('eInvalid', k);
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new ReceiptError('eObject');
  if (String(d.v) !== FORMAT_VERSION) throw new ReceiptError('eVersion', d.v);
  // 잔디밭을 숨기면(hg) 날짜별 값 대신 거기서 나오는 숫자(사용한 날, 최장 연속)만 담는다
  const missing = REQUIRED.concat(d.hp ? [] : PATIENCE, d.hg ? ['ad', 'st'] : ['d']).filter(k => d[k] === undefined || d[k] === null);
  if (missing.length) throw new ReceiptError('eMissing', missing.join(', '));
  for (const [k, n] of Object.entries(LENGTHS))
    if (!Array.isArray(d[k]) || d[k].length !== n) throw new ReceiptError('eArray', k, n);
  const span = v => Array.isArray(v) && v.length === 3 && isInt(v[0]) && typeof v[1] === 'string' && MD.test(v[1]) && typeof v[2] === 'string' && MD.test(v[2]);
  if (d.hg) {
    if (!isInt(d.ad)) throw bad('ad');
    if (!span(d.st)) throw bad('st');
    if (d.gp != null && !span(d.gp)) throw bad('gp');
  } else if (typeof d.d !== 'string' || !/^[0-4]{365,366}$/.test(d.d)) throw new ReceiptError('eGrid');
  if (typeof d.n !== 'string' || !d.n.trim() || [...d.n].length > 20 || !PRINTABLE.test(d.n)) throw new ReceiptError('eNick');
  if (typeof d.fp !== 'string' || !STAMP.test(d.fp)) throw bad('fp');
  for (const k of COUNTS) if (!isInt(d[k])) throw bad(k);
  for (const k of SHARES) if (!isNum(d[k])) throw bad(k);
  for (const k of OPTIONAL_COUNTS) if (d[k] != null && !isInt(d[k])) throw bad(k);
  for (const k of OPTIONAL_SHARES) if (d[k] != null && !isNum(d[k])) throw bad(k);
  const tools = d.src;
  if (!Array.isArray(tools) || !tools.length || new Set(tools).size !== tools.length || !tools.every(x => TOOLS.includes(x))) throw bad('src');
  // 도구별 프롬프트 수는 도구마다 하나씩 있고 합이 전체와 같아야 한다
  if (!(isList(d.bt, TOOLS.length, 20) && d.bt.length === tools.length
    && tools.every(x => d.bt.some(r => r[0] === x)) && d.bt.reduce((a, r) => a + r[1], 0) === d.p)) throw bad('bt');
  if (d.p < 1) throw bad('p');
  for (const k of ['q', 'h', 'w']) if (!d[k].every(isInt)) throw bad(k);
  if (!d.hp) {
    for (const k of ['co', 'pf']) if (!Array.isArray(d[k]) || d[k].length !== 2 || !isInt(d[k][0]) || !isNum(d[k][1])) throw bad(k);
    if (!Array.isArray(d.pm) || d.pm.length !== 12 || !d.pm.every(v => v === null || isNum(v))) throw bad('pm');
  }
  if (!d.mc.every(v => v === null || isInt(v))) throw bad('mc');
  if (!isInt(d.bd[0]) || typeof d.bd[1] !== 'string' || !MD.test(d.bd[1])) throw bad('bd');
  if (!isInt(d.bh[0]) || typeof d.bh[1] !== 'string' || !MDHM.test(d.bh[1])) throw bad('bh');
  if (d.ld != null && !(Array.isArray(d.ld) && d.ld.length === 2 && typeof d.ld[0] === 'string' && HM.test(d.ld[0])
    && typeof d.ld[1] === 'string' && MD.test(d.ld[1]))) throw bad('ld');
  if (d.ph != null && !(isList(d.ph, 5, 12) && d.ph.every(r => PRINTABLE.test(r[0])))) throw bad('ph');
  if (d.sc != null && !isList(d.sc, 5, 40)) throw bad('sc');
  let moTools = 0;
  if (d.mo != null) {      // 도구별 목록
    if (typeof d.mo !== 'object' || Array.isArray(d.mo)) throw bad('mo');
    const lists = Object.entries(d.mo).map(([k, v]) => (tools.includes(k) ? v : null));
    if (!lists.every(v => isList(v, 30, 80))) throw bad('mo');
    moTools = lists.filter(v => v.length).length;
  }
  // 최근 30일 도구별 프롬프트 수. 여러 도구의 모델을 합칠 때 가중치로 쓰므로 그때는 꼭 있어야 한다
  if (d.p30 == null ? moTools > 1 : !(isList(d.p30, TOOLS.length, 20) && d.p30.length === tools.length
    && tools.every(x => d.p30.some(r => r[0] === x)))) throw bad('p30');
}

// 에이전트는 개수만 넘긴다(pc가 있으면 그 모양). 합계, 평균, 비율은 여기서 낸다
function fromAgent(d) {
  if (!d || typeof d !== 'object' || d.pc == null) return d;
  const bt = Array.isArray(d.bt) ? d.bt.filter(r => Array.isArray(r) && isInt(r[1])) : [];
  d.p = bt.reduce((a, r) => a + r[1], 0);
  const pc = d.pc;
  delete d.pc;
  d.al = isInt(d.tc) && pc ? Math.round(d.tc / pc) : 0;
  d.ss = pct(d.ss, pc);
  d.hs = pct(d.hs, pc);
  if (d.ps != null) d.ps = pct(d.ps, (bt.find(r => r[0] === 'claude-code') || [0, 0])[1]);
  if (Array.isArray(d.pm) && Array.isArray(d.mc)) d.pm = d.pm.map((n, k) => (d.mc[k] ? pct(n, d.mc[k]) : null));
  if (isInt(d.co)) d.co = [d.co, pct(d.co, d.p)];
  if (isInt(d.pf)) d.pf = [d.pf, pct(d.pf, d.p)];
  return d;
}

// 에이전트가 넘긴 값: #j=<base64url JSON>
function parseHandoff(hash) {
  if (hash.length > MAX_HANDOFF) throw new ReceiptError('eInvalid', 'j');
  let data;
  try {
    data = fromAgent(JSON.parse(new TextDecoder().decode(fromB64url(hash.slice(3).replace(/=+$/, '')))));
  } catch (e) {
    throw new ReceiptError('eIngest');
  }
  validate(data);
  return data;
}

// 발행 시각은 페이지가 찍는다. 이후에는 주소에 고정된다
function stamp(data, now) {
  data.iss = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())} ${two(now.getHours())}:${two(now.getMinutes())}`;
  return data;
}

// ---- 이진 형식 ---------------------------------------------------------
// 주소를 짧게 하려고 값을 JSON 대신 바이트로 담는다. 숫자는 가변 길이 정수, 비율은 10배 한 정수,
// 잔디밭은 5진수 한 덩어리, 날짜와 시각은 작은 정수로 바꾼다. 순서는 pack()과 unpack()이 같아야 한다.

const EPOCH = Date.UTC(2000, 0, 1);
const stampToMin = s => Math.round((Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), +s.slice(11, 13), +s.slice(14, 16)) - EPOCH) / 60000);
const minToStamp = m => new Date(EPOCH + m * 60000).toISOString().slice(0, 16).replace('T', ' ');
const mdToNum = s => +s.slice(0, 2) * 32 + +s.slice(3, 5);
const numToMd = n => `${two(n >> 5)}-${two(n & 31)}`;
const hmToNum = s => +s.slice(0, 2) * 60 + +s.slice(3, 5);
const numToHm = n => `${two(Math.floor(n / 60))}:${two(n % 60)}`;
const gridBytes = len => Math.ceil(len * Math.log2(5) / 8);
const r1 = x => Math.round(x * 10) / 10;
const EXTRAS = ['ps', 'btw', 'rw', 'sc'];      // Claude Code를 골랐을 때만 있는 값

// 값의 모양을 하나로 맞춘다. 주소에 담기는 것은 이 모양이다
function normalize(d) {
  const tools = TOOLS.filter(x => d.src.includes(x));
  const bt = tools.map(x => [x, d.bt.find(r => r[0] === x)[1]]);
  const mo = {};
  for (const x of tools) if (d.mo && d.mo[x] && d.mo[x].length) mo[x] = d.mo[x].map(r => [r[0], r[1]]);
  const out = {
    v: 1, src: tools, lg: d.lg === 'ko' ? 'ko' : 'en', n: d.n, p: d.p, bt, s: d.s, pj: d.pj, fp: d.fp,
    bd: d.bd, bh: d.bh, q: d.q, mc: d.mc, h: d.h, w: d.w, ld: d.ld || null,
    tc: d.tc, al: d.al, ss: r1(d.ss), hs: r1(d.hs), ls: d.ls, mp: d.mp, ph: d.ph || [],
    mo: Object.keys(mo).length ? mo : null,
    p30: d.p30 ? tools.map(x => [x, d.p30.find(r => r[0] === x)[1]]) : null,
  };
  if (d.hg) Object.assign(out, { hg: true, ad: d.ad, st: d.st, gp: d.gp || null });
  else out.d = d.d;
  if (d.hp) out.hp = true;
  else Object.assign(out, { co: [d.co[0], r1(d.co[1])], pf: [d.pf[0], r1(d.pf[1])], pm: d.pm.map(v => (v === null ? null : r1(v))) });
  for (const k of EXTRAS) if (d[k] != null) out[k] = k === 'ps' ? r1(d[k]) : d[k];
  out.iss = d.iss;
  return out;
}

function pack(d) {
  const out = [];
  const int = n => { do { const b = n % 128; n = Math.floor(n / 128); out.push(n ? b | 128 : b); } while (n); };
  const share = x => int(Math.round(x * 10));
  const str = s => { const b = new TextEncoder().encode(s); int(b.length); out.push(...b); };
  const list = rows => { int(rows.length); for (const [s, n] of rows) { str(s); int(n); } };
  const masked = (arr, put) => {
    int(arr.reduce((m, v, i) => (v === null ? m : m | (1 << i)), 0));
    for (const v of arr) if (v !== null) put(v);
  };

  out.push(TOOLS.reduce((m, x, i) => (d.src.includes(x) ? m | (1 << i) : m), 0)
    | (d.lg === 'ko' ? 16 : 0) | (d.ld ? 32 : 0) | (!d.hg && d.d.length === 366 ? 64 : 0) | (d.p30 ? 128 : 0));
  out.push(EXTRAS.reduce((m, k, i) => (d[k] != null ? m | (1 << i) : m), 0) | (d.hp ? 16 : 0) | (d.hg ? 32 : 0) | (d.hg && d.gp ? 64 : 0));
  str(d.n);
  for (const [, n] of d.bt) int(n);
  int(d.s); int(d.pj); int(stampToMin(d.fp)); int(stampToMin(d.iss));
  int(d.bd[0]); int(mdToNum(d.bd[1]));
  int(d.bh[0]); int(mdToNum(d.bh[1])); int(hmToNum(d.bh[1].slice(6)));
  d.q.forEach(int);
  const span = v => { int(v[0]); int(mdToNum(v[1])); int(mdToNum(v[2])); };
  if (d.hg) {
    int(d.ad); span(d.st);
    if (d.gp) span(d.gp);
  } else {
    let grid = 0n;
    for (const ch of d.d) grid = grid * 5n + BigInt(ch);
    const gb = new Array(gridBytes(d.d.length));
    for (let i = gb.length - 1; i >= 0; i--) { gb[i] = Number(grid & 255n); grid >>= 8n; }
    out.push(...gb);
  }
  masked(d.mc, int);
  d.h.forEach(int); d.w.forEach(int);
  if (d.ld) { int(hmToNum(d.ld[0])); int(mdToNum(d.ld[1])); }
  int(d.tc); int(d.al); share(d.ss); share(d.hs); int(d.ls); int(d.mp);
  list(d.ph);
  for (const x of d.src) list((d.mo && d.mo[x]) || []);
  if (d.p30) for (const [, n] of d.p30) int(n);
  if (!d.hp) { int(d.co[0]); share(d.co[1]); int(d.pf[0]); share(d.pf[1]); masked(d.pm, share); }
  if (d.ps != null) share(d.ps);
  if (d.btw != null) int(d.btw);
  if (d.rw != null) int(d.rw);
  if (d.sc != null) list(d.sc);
  return Uint8Array.from(out);
}

function unpack(bytes) {
  let at = 0;
  const byte = () => { if (at >= bytes.length) throw new Error('short'); return bytes[at++]; };
  const int = () => { let n = 0, mul = 1, b; do { b = byte(); n += (b & 127) * mul; mul *= 128; } while (b & 128); return n; };
  const share = () => int() / 10;
  const str = () => { const len = int(); if (at + len > bytes.length) throw new Error('short'); const s = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(at, at + len)); at += len; return s; };
  const list = () => Array.from({ length: Math.min(int(), 64) }, () => [str(), int()]);
  const masked = (len, get) => { const m = int(); return Array.from({ length: len }, (_, i) => (m & (1 << i) ? get() : null)); };
  const times = (n, get) => Array.from({ length: n }, get);

  const flags = byte(), extras = byte();
  const d = { v: 1, src: TOOLS.filter((_, i) => flags & (1 << i)), lg: flags & 16 ? 'ko' : 'en' };
  d.n = str();
  d.bt = d.src.map(x => [x, int()]);
  d.p = d.bt.reduce((a, r) => a + r[1], 0);
  d.s = int(); d.pj = int(); d.fp = minToStamp(int());
  const iss = minToStamp(int());
  d.bd = [int(), numToMd(int())];
  d.bh = [int(), `${numToMd(int())} ${numToHm(int())}`];
  d.q = times(3, int);
  const span = () => [int(), numToMd(int()), numToMd(int())];
  if (extras & 32) {
    d.hg = true; d.ad = int(); d.st = span(); d.gp = extras & 64 ? span() : null;
  } else {
    const len = flags & 64 ? 366 : 365;
    let grid = 0n;
    for (let i = gridBytes(len); i > 0; i--) grid = (grid << 8n) | BigInt(byte());
    const digits = new Array(len);
    for (let i = len - 1; i >= 0; i--) { digits[i] = String(grid % 5n); grid /= 5n; }
    if (grid !== 0n) throw new Error('grid');
    d.d = digits.join('');
  }
  d.mc = masked(12, int);
  d.h = times(24, int); d.w = times(7, int);
  d.ld = flags & 32 ? [numToHm(int()), numToMd(int())] : null;
  d.tc = int(); d.al = int(); d.ss = share(); d.hs = share(); d.ls = int(); d.mp = int();
  d.ph = list();
  const mo = {};
  for (const x of d.src) { const rows = list(); if (rows.length) mo[x] = rows; }
  d.mo = Object.keys(mo).length ? mo : null;
  d.p30 = flags & 128 ? d.src.map(x => [x, int()]) : null;
  if (extras & 16) d.hp = true;
  else { d.co = [int(), share()]; d.pf = [int(), share()]; d.pm = masked(12, share); }
  if (extras & 1) d.ps = share();
  if (extras & 2) d.btw = int();
  if (extras & 4) d.rw = int();
  if (extras & 8) d.sc = list();
  d.iss = iss;
  if (at !== bytes.length) throw new Error('trailing');
  return d;
}

// QR의 영숫자 모드가 받는 문자 중 숫자, 영문 대문자, 기호 $ + - 만 쓴다. 같은 데이터도 QR 칸 수가 줄어든다.
// . : / 는 구분자와 겹치거나 주소의 다른 부분(://, /..)처럼 보일 수 있어 뺐다
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$+-';
const RADIX = BigInt(ALPHABET.length);

function toText(bytes) {
  let n = 1n;                                   // 앞자리 0 바이트를 지키려고 1을 앞에 둔다
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = '';
  for (; n > 0n; n /= RADIX) out = ALPHABET[Number(n % RADIX)] + out;
  return out;
}

function fromText(text) {
  let n = 0n;
  for (const ch of text) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) throw new Error('alphabet');
    n = n * RADIX + BigInt(v);
  }
  const hex = n.toString(16);
  if (hex.length % 2 === 0 || hex[0] !== '1') throw new Error('marker');
  return Uint8Array.from(hex.slice(1).match(/../g) || [], h => parseInt(h, 16));
}

// 정식 주소: #<버전>.<데이터>.<검증 번호>. 데이터 = 이진 값을 raw deflate로 압축해 위 문자로 적은 것,
// 검증 번호 = sha256(이진 값) 앞 8자리. 메신저가 링크 끝의 기호를 잘라내지 않도록 검증 번호를 맨 뒤에 둔다
async function encode(data) {
  const raw = pack(normalize(data));
  const packed = await pipe(raw, new CompressionStream('deflate-raw'));
  const check = await checkOf(raw);
  return { hash: `#${FORMAT_VERSION}.${toText(packed)}.${check}`, check };
}

async function decode(hash) {
  const m = /^#(\d+)\.([0-9A-Z$+-]+)\.([0-9A-F]{8})$/.exec(hash);
  if (!m || hash.length > MAX_HANDOFF) throw new ReceiptError('eFormat');
  if (m[1] !== FORMAT_VERSION) throw new ReceiptError('eVersion', m[1]);
  let raw, data;
  try {
    raw = await pipe(fromText(m[2]), new DecompressionStream('deflate-raw'));
    data = unpack(raw);
  } catch (e) {
    throw new ReceiptError('eUnpack');
  }
  validate(data);
  if (!STAMP.test(data.iss)) throw new ReceiptError('eInvalid', 'iss');
  return { data, check: m[3], ok: (await checkOf(raw)) === m[3] };
}

// 넘겨받은 값에서 나머지를 계산한다. 같은 데이터면 항상 같은 결과.
function modelName(id) {
  id = String(id);
  // Bedrock, Vertex 등은 앞뒤에 다른 글자가 붙는다 (us.anthropic.claude-opus-4-8-v1:0, claude-opus-4-8@20260101)
  let m = /claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?!\d)/.exec(id);
  if (m) return m[1][0].toUpperCase() + m[1].slice(1) + ' ' + m[2] + (m[3] ? '.' + m[3] : '');
  m = /claude-(\d+)(?:-(\d))?-([a-z]+)/.exec(id);
  if (m) return m[3][0].toUpperCase() + m[3].slice(1) + ' ' + m[1] + (m[2] ? '.' + m[2] : '');
  return id.slice(0, 18);   // 모르는 형식은 그대로, 이름 칸 최대 폭(18자)까지
}

function derive(d) {
  const sum = a => a.reduce((x, y) => x + y, 0);
  const y = +d.fp.slice(0, 4);
  const jan1 = Date.UTC(y, 0, 1);
  const idx = iso => Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - jan1) / 864e5);
  const md = i => new Date(jan1 + i * 864e5).toISOString().slice(5, 10);
  const iso = i => new Date(jan1 + i * 864e5).toISOString().slice(0, 10);
  const first = idx(d.fp);
  const yearDays = Math.round((Date.UTC(y + 1, 0, 1) - jan1) / 864e5);
  const end = Math.max(first, Math.min(idx(d.iss), yearDays - 1));
  let st, gp, ad;
  if (d.hg) {                // 잔디밭을 숨긴 영수증: 날짜별 값이 없고 계산된 숫자만 있다
    ad = d.ad || 1; st = d.st; gp = d.gp;
  } else {
    const active = [];
    for (let i = first; i <= end; i++) if (d.d[i] !== '0') active.push(i);
    let best = [1, first, first], idle = null, run = 1, runStart = active[0] ?? first;
    for (let k = 1; k < active.length; k++) {
      const gap = active[k] - active[k - 1];
      if (gap === 1) run++;
      else {
        run = 1; runStart = active[k];
        if (!idle || gap - 1 > idle[0]) idle = [gap - 1, active[k - 1] + 1, active[k] - 1];
      }
      if (run > best[0]) best = [run, runStart, active[k]];
    }
    ad = active.length || 1;
    st = [best[0], md(best[1]), md(best[2])];
    gp = idle && [idle[0], md(idle[1]), md(idle[2])];
  }
  const months = (d.pm || []).map((v, i) => [i + 1, v, d.mc[i]]).filter(m => m[1] !== null && m[2] >= 50);
  const pickMonth = sign => months.reduce((b, m) => (!b || sign * (m[1] - b[1]) > 0 || (m[1] === b[1] && m[2] > b[2]) ? m : b), null);
  // 모델 비율은 도구 구분 없이 하나로 합친다. Claude Code는 응답 수, Codex는 턴 수라 단위가 달라서
  // 도구 안에서 비율을 낸 뒤 그 도구의 최근 30일 프롬프트 비중을 곱해 더한다
  const byTool = d.mo || {};
  const used = d.src.filter(x => sum((byTool[x] || []).map(r => r[1])) > 0);
  const prompts = x => (d.p30 ? (d.p30.find(r => r[0] === x) || [x, 0])[1] : 1);
  const weightSum = sum(used.map(prompts));
  const by = {};
  for (const x of used) {
    const total = sum(byTool[x].map(r => r[1]));
    const weight = weightSum ? prompts(x) / weightSum : 1 / used.length;
    for (const [id, n] of byTool[x]) by[modelName(id)] = (by[modelName(id)] || 0) + weight * n / total;
  }
  const rows = Object.entries(by).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  let mo = null;
  if (rows.length) {
    const s = rows.slice(0, 5).map(([k, v]) => [k, pct(v, 1)]);
    const rest = pct(sum(rows.slice(5).map(r => r[1])), 1);
    if (rest >= 0.1) s.push(['Other', rest]);
    mo = { d: 30, s };
  }
  const wm = pickMonth(1), cm = pickMonth(-1);
  return {
    ...d, y, f: iso(first), e: iso(end), ad,
    ar: pct(ad, end - first + 1), pd: Math.round(d.p / ad), pss: Math.round(d.p / (d.s || 1) * 10) / 10,
    st, gp,
    ns: pct(sum(d.h.slice(0, 6)), d.p), mrs: pct(sum(d.h.slice(6, 9)), d.p), ws: pct(d.w[5] + d.w[6], d.p),
    wm: wm && [wm[0], wm[1]], cm: cm && [cm[0], cm[1]], mo,
  };
}

if (typeof module !== 'undefined') {
  module.exports = { ReceiptError, validate, normalize, fromAgent, parseHandoff, stamp, encode, decode, modelName, derive };
}
