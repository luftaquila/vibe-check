// vibe-check 페이지: 넘겨받은 값을 검증하고 영수증을 그린다. 데이터는 서버로 가지 않는다.

const $ = s => document.querySelector(s);
const base = () => location.origin + location.pathname;

const UI = {
  en: {
    tagline: 'A receipt for your year with a coding agent.\nWorks with Claude Code and Codex.',
    howTitle: 'How it works',
    how1: 'Copy the prompt below and paste it into Claude Code or Codex.',
    how2: 'Answer its questions. It counts your history on your own computer and sends only the numbers here.',
    how3: 'Scan the QR code at the bottom to open the same receipt again.',
    lexicon: 'Your agent picks the swear words to look for in the languages you use. The criteria can differ from person to person.',
    promptTitle: 'Prompt', copy: 'Copy', copied: 'Copied', selected: 'Press Ctrl+C to copy',
    promptLoading: 'Loading', promptFail: 'The prompt did not load. You can find it as prompt.md on GitHub.',
    promptHead: null,
    dataTitle: 'Where your data goes',
    data1: 'Your history is counted only on your computer. What you typed stays off the receipt, apart from your five most used short prompts.',
    data2: 'Anyone you give the URL or QR code to can read the receipt.',
    save: 'Save image', viewFull: 'Full receipt', viewCard: 'Summary card', showTitle: 'Show on receipt', showHg: 'Activity', showPh: 'Short prompt list', showPat: 'Patience', showMo: 'Models, last 30 days', make: 'Make my receipt',
    font: 'Font: NeoDunggeunmo Code (SIL OFL 1.1)', qr: 'QR: qrcode-generator (MIT)',
    bad: no => `Check number ${no} does not match. The data in this URL may have been edited.`,
    receiptAlt: d => `${d.n}'s ${d.y} receipt`,
    pageTitle: d => `${d.n}'s ${d.y} year in review`,
    eFormat: 'This does not look like a receipt URL. It may have been cut off.',
    eVersion: v => `This receipt is version ${v}, which this page cannot read.`,
    eUnpack: 'The receipt data could not be read. The URL may have been cut off.',
    eIngest: 'The values could not be read. They should be JSON encoded as base64url.',
    eObject: 'The receipt data is not a JSON object.',
    eMissing: k => `Some values are missing: ${k}`,
    eArray: (k, n) => `Value ${k} must be an array of ${n}.`,
    eGrid: 'Value d must be a string of 365 or 366 digits from 0 to 4.',
    eNick: 'The nickname must be 1 to 20 characters, in English or Korean.',
    eInvalid: k => `Value ${k} is not valid.`,
    eUnknown: 'Something went wrong while drawing the receipt.',
    copyLink: 'Copy link',
  },
  ko: {
    tagline: '코딩 에이전트와 보낸 1년을 영수증 한 장으로 뽑아 드립니다.\nClaude Code와 Codex를 지원합니다.',
    howTitle: '만드는 법',
    how1: '아래 프롬프트를 복사해 Claude Code나 Codex에 붙여 넣습니다.',
    how2: '질문에 답하면 에이전트가 내 컴퓨터에서 기록을 세어 숫자만 이 페이지로 보냅니다.',
    how3: '영수증 맨 아래 QR을 찍으면 같은 영수증이 다시 열립니다.',
    lexicon: '욕설 목록은 에이전트가 내가 쓰는 언어에 맞춰 직접 만듭니다. 사람마다 기준이 다를 수 있습니다.',
    promptTitle: '프롬프트', copy: '복사', copied: '복사됨', selected: 'Ctrl+C로 복사해 주세요',
    promptLoading: '불러오는 중', promptFail: '프롬프트를 불러오지 못했습니다. GitHub의 prompt.md에서 볼 수 있습니다.',
    promptHead: '코딩 에이전트 연간 결산 영수증 생성.\n\n- 이 컴퓨터에 기록 파일이 있는 도구 확인 (규칙의 Input 참고). 아직 파일을 읽지 말 것.\n- 네 가지 질문 후 답을 받기 전 진행 금지: 닉네임(20자 이내, 한글이나 영문), 연도(기본값: 올해), 프롬프트에 쓰는 언어, 찾은 도구 중 포함할 것(기본값: 전부).\n- 아래 규칙(영문)대로 이 컴퓨터에서 집계. 결과는 JSON 하나.\n- 규칙의 Delivery 방법대로 영수증 페이지 열기.\n- 보고는 한 줄: 영수증을 열었다는 것, 아니면 주소가 있는 곳(Delivery 참고). 주소를 직접 옮겨 적지 말 것. 해석, 칭찬, 요약 금지.',
    dataTitle: '내 기록은 어디로 가나요',
    data1: '기록은 내 컴퓨터에서만 세고, 영수증에는 자주 쓴 짧은 프롬프트 5개 말고는 내가 쓴 문장이 들어가지 않습니다.',
    data2: '주소나 QR을 받은 사람은 영수증 내용을 볼 수 있습니다.',
    save: '이미지 저장', viewFull: '전체 영수증', viewCard: '요약 카드', showTitle: '영수증에 표시', showHg: '잔디밭', showPh: '짧은 프롬프트 목록', showPat: '인내심 지표', showMo: '최근 30일 사용 모델', make: '내 영수증 만들기',
    font: '글꼴 Neo둥근모 Code (SIL OFL 1.1)', qr: 'QR qrcode-generator (MIT)',
    bad: no => `검증 번호 ${no}가 내용과 다릅니다. 주소 속 데이터를 고쳤을 수 있습니다.`,
    receiptAlt: d => `${d.n}의 ${d.y} 연간 결산 영수증`,
    pageTitle: d => `${d.n}의 ${d.y} 연간 결산`,
    eFormat: '영수증 주소가 아닙니다. 주소가 중간에 잘렸을 수 있습니다.',
    eVersion: v => `버전 ${v} 영수증은 이 페이지에서 열 수 없습니다.`,
    eUnpack: '영수증 데이터를 읽지 못했습니다. 주소가 중간에 잘렸을 수 있습니다.',
    eIngest: '값을 읽지 못했습니다. JSON을 base64url로 바꾼 값이어야 합니다.',
    eObject: '영수증 데이터가 JSON 객체가 아닙니다.',
    eMissing: k => `빠진 값이 있습니다: ${k}`,
    eArray: (k, n) => `값 ${k}는 ${n}개짜리 배열이어야 합니다.`,
    eGrid: '값 d는 0 ~ 4로 된 365자 또는 366자 문자열이어야 합니다.',
    eNick: '닉네임은 한글이나 영문 1 ~ 20자여야 합니다.',
    eInvalid: k => `값 ${k}이(가) 올바르지 않습니다.`,
    eUnknown: '영수증을 그리다가 문제가 생겼습니다.',
    copyLink: '주소 복사',
  },
};

// 언어: 주소의 ?lang= > 토글로 고른 값 > 영수증을 만든 사람의 언어 > 영문
let chosen = null;
try { chosen = localStorage.getItem('lang'); } catch (e) { /* 저장소를 못 써도 동작 */ }
const fromQuery = new URLSearchParams(location.search).get('lang');
const pick = v => (v === 'ko' || v === 'en' ? v : null);
let lang = pick(fromQuery) || pick(chosen) || 'en';
const explicit = () => pick(fromQuery) || pick(chosen);
const t = () => UI[lang];

function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t()[el.dataset.i18n];
  });
  $('#lang').setAttribute('aria-checked', String(lang === 'ko'));
}

// 에이전트가 넘긴 값(#j=base64url JSON)을 검증하고 정식 주소(#버전.검증 번호.압축 데이터)로 바꾼다
async function ingest(hash) {
  const data = parseHandoff(hash);
  stamp(data, new Date());
  const { hash: canonical } = await encode(data);
  history.replaceState(null, '', location.pathname + location.search + canonical);
}

function errText(e) {
  if (!(e instanceof ReceiptError)) return t().eUnknown;
  const m = t()[e.key];
  return typeof m === 'function' ? m(...e.args) : m;
}

function mount(el, canvas, label) {
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', label);
  el.replaceChildren(canvas);
}

// 버튼 글자를 잠깐 바꿨다가 되돌린다. keep이면 그동안 버튼 폭을 그대로 둔다
function flash(btn, text, back, keep = true) {
  btn.style.width = keep ? btn.offsetWidth + 'px' : '';
  btn.textContent = text;
  clearTimeout(btn.flashTimer);
  btn.flashTimer = setTimeout(() => { btn.textContent = back(); btn.style.width = ''; }, 2000);
}

function download(canvas, name) {
  canvas.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
}

// 지금 보이는 것: 전체 영수증(full) 또는 요약 카드(card). 저장 버튼은 보이는 쪽을 저장한다
let current = null;
let view = 'full';

function saveButton(canvas) {
  $('#save').hidden = false;
  $('#save').onclick = () => download(canvas, `vibe-check-${current.data.y}${view === 'card' ? '-card' : ''}.png`);
}

function syncView() {
  document.querySelectorAll('#views button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === view)));
  // 지금 보기에 나오는 항목의 스위치만 보인다
  document.querySelectorAll('#hides label').forEach(l => { l.hidden = !l.dataset.views.split(' ').includes(view); });
  $('#views').hidden = false;
}

// 표시 스위치(켜짐 = 보임). full = 이 화면에서 처음 연 값, 끄면 그 값을 뺀 주소로 바꾼다
let full = null, ownHash = null;
const hides = { hg: false, ph: false, pat: false, mo: false };
const HIDES = Object.keys(hides);
const locked = () => ({ hg: !!full.hg, ph: !(full.ph && full.ph.length), pat: !!full.hp, mo: !full.mo });   // 처음부터 없던 값은 되살릴 수 없다

function syncHides() {
  const lock = locked();
  for (const k of HIDES) {
    const sw = $('#hide-' + k);
    sw.setAttribute('aria-checked', String(!(hides[k] || lock[k])));      // 켜짐 = 영수증에 보임
    sw.disabled = lock[k];
  }
  $('#hides').hidden = false;
}

async function toggleHide(key) {
  hides[key] = !hides[key];
  const d = structuredClone(full);
  if (hides.hg && !d.hg) {      // 날짜별 값을 빼고, 거기서 나오는 숫자만 남긴다
    const x = derive(full);
    Object.assign(d, { hg: true, ad: x.ad, st: x.st, gp: x.gp });
    delete d.d;
  }
  if (hides.ph) d.ph = [];
  if (hides.pat) { d.hp = true; for (const k of ['co', 'pf', 'pm']) delete d[k]; }
  if (hides.mo) { d.mo = null; d.p30 = null; }
  const { hash } = await encode(d);
  ownHash = hash;
  history.replaceState(null, '', location.pathname + location.search + hash);
  showReceipt();
}

function linkButton() {
  const btn = $('#link');
  btn.hidden = false;
  btn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
    } catch (e) {            // 클립보드를 못 쓰는 환경
      const box = document.createElement('textarea');
      box.value = location.href;
      document.body.append(box);
      box.select();
      document.execCommand('copy');
      box.remove();
    }
    flash(btn, t().copied, () => t().copyLink);
  };
}

let turn = 0;   // 언어를 빠르게 바꿀 때 늦게 끝난 렌더링을 버린다

async function showReceipt() {
  const mine = ++turn;
  $('#landing').hidden = true;
  $('#viewer').hidden = false;
  const status = $('#status');
  if (!status.hidden) status.hidden = true;      // 알림은 문제가 있을 때만 보인다
  const controls = ['#save', '#link', '#hides', '#views'];
  if (!current) $('#panel').hidden = true;      // 처음 열 때만 숨긴다. 다시 그릴 때는 그대로 둔다
  try {
    if (location.hash.startsWith('#j=')) await ingest(location.hash);
    const { data, check, ok } = await decode(location.hash);
    if (!explicit() && pick(data.lg) && data.lg !== lang) { lang = data.lg; applyLang(); }
    // QR에는 언어 선택과 무관한 정식 주소만 넣는다
    data.y = +data.fp.slice(0, 4);      // 제목과 파일 이름에 쓰는 연도
    if (location.hash !== ownHash) { full = structuredClone(data); for (const k of HIDES) hides[k] = false; }   // 새로 연 영수증
    const url = base() + location.hash;
    const canvas = await renderReceipt(data, url, check, lang, view === 'card');
    if (mine !== turn) return;
    current = { data, url, check };
    mount($('#receipt'), canvas, t().receiptAlt(data));
    document.title = t().pageTitle(data);
    const no = `${check.slice(0, 4)}-${check.slice(4)}`;
    if (!ok) {
      status.className = 'status bad';
      status.textContent = t().bad(no);
      status.hidden = false;
    }
    saveButton(canvas);
    linkButton();
    syncHides();
    syncView();
    $('#panel').hidden = false;
  } catch (e) {
    if (mine !== turn) return;
    status.className = 'status bad';
    status.textContent = errText(e);
    status.hidden = false;
    $('#receipt').replaceChildren();
    current = null;
    $('#panel').hidden = true;
  }
}

async function showLanding() {
  const mine = ++turn;
  current = null;
  $('#viewer').hidden = true;
  $('#landing').hidden = false;
  document.title = 'vibe-check';
  const pre = $('#prompt');
  pre.textContent = t().promptLoading;
  try {
    const res = await fetch('prompt.md', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    let text = (await res.text()).trim();
    if (t().promptHead) {      // 규칙은 영문 한 벌. 머리말과 영수증 언어만 바꾼다
      const at = text.indexOf('# Rules');
      if (at < 0 || !text.includes('| `lg` | `"en"` |')) throw new Error('prompt format');
      text = t().promptHead + '\n\n' + text.slice(at).replace('| `lg` | `"en"` |', '| `lg` | `"' + lang + '"` |');
    }
    if (mine === turn) pre.textContent = text;
  } catch (e) {
    if (mine === turn) pre.textContent = t().promptFail;
  }
  $('#copy').onclick = async () => {
    try {
      await navigator.clipboard.writeText(pre.textContent);
      flash($('#copy'), t().copied, () => t().copy);
    } catch (e) {
      getSelection().selectAllChildren(pre);
      flash($('#copy'), t().selected, () => t().copy, false);      // 안내 문구는 길어서 폭을 풀어 준다
    }
  };
}

function route() {
  applyLang();
  return location.hash.length > 1 ? showReceipt() : showLanding();
}

$('#lang').addEventListener('click', () => {
  lang = lang === 'ko' ? 'en' : 'ko';
  chosen = lang;
  try { localStorage.setItem('lang', lang); } catch (e) { /* 저장 실패는 무시 */ }
  route();
});
for (const k of HIDES) $('#hide-' + k).addEventListener('click', () => toggleHide(k));
document.querySelectorAll('#views button').forEach(b => b.addEventListener('click', () => { view = b.dataset.view; showReceipt(); }));
window.addEventListener('hashchange', route);
route();
