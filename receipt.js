// vibe-check 영수증 렌더러.
// 80mm 감열 프린터 규격: 인쇄폭 576 dot, 기본 글꼴 12x24(한글 24x24), 한 줄 48칸, 줄 간격 30 dot.
// 같은 데이터면 같은 그림이 나온다. 문구, 순서, 칭호 조건은 이 파일에만 정의한다.

const PW = 576;            // 인쇄폭
const PM = 24;             // 종이 좌우 여백
const PAPER_W = PW + 2 * PM;
const FS = 24;             // 기본 글꼴
const FS_SMALL = 16;       // 작은 글꼴
const LH = 30;             // 줄 간격
const COLS = PW / (FS / 2);
const S = 2;               // 출력 배율
const PAD = 36;            // 종이 바깥 여백
const INK = '#161616';
const PAPER = '#fdfdfb';
const BG = '#e0e2e6';
const FONT = '"NeoDGM Code"';
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const TOOL_NAMES = { 'claude-code': 'Claude Code', codex: 'Codex' };

const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const f1 = v => Number(v).toFixed(1);
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 문구표. 영수증 언어는 여기서만 갈린다.
const L = {
  en: {
    title: y => `${y} YEAR IN REVIEW`,
    nickname: 'Nickname', period: 'Period', issued: 'Issued',
    prompts: 'Prompts sent', sessions: 'Sessions', folders: 'Folders',
    activeDays: 'Days used', dailyAvg: 'Per day', firstPrompt: 'First prompt',
    streak: 'Longest streak', gap: 'Longest break', busiestDay: 'Busiest day', busiestHour: 'Busiest hour',
    count: n => fmt(n), days: n => `${n} days`, chars: n => `${fmt(n)} chars`, times: n => `${fmt(n)}x`,
    grass: 'ACTIVITY', perDay: 'Prompts per day', orMore: n => `${n}+`,
    wdShort: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'], wd: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], wdCols: 3,
    month: i => MONTHS_EN[i], hourAxis: h => String(h).padStart(2, '0'), hourFull: h => `${h}:00`,
    range: (a, b) => `${a} ~ ${b}`, from: x => `${x}~`, longestVal: n => `${fmt(n)} prompts`, perSessionVal: v => f1(v),
    byMonth: 'PROMPTS BY MONTH', byHour: 'PROMPTS BY HOUR', byWeekday: 'PROMPTS BY WEEKDAY',
    peakHour: 'Busiest time of day', night: 'Midnight to 6 AM', latest: 'Latest night', weekend: 'Weekends',
    style: 'HOW YOU WORK', typed: 'Characters typed', avgLen: 'Average prompt length',
    short: 'Prompts of 12 characters or fewer', hangul: 'Prompts in Korean', pasted: 'Prompts with a paste',
    perSession: 'Prompts per session', longest: 'Longest session',
    parallel: 'Most sessions at once', phrases: '[Top short prompts]', commands: '[Top slash commands]',
    models: n => `MODELS, LAST ${n} DAYS`, other: 'Other',
    patience: 'PATIENCE', correction: 'Prompts starting with "no"', profanity: 'Prompts with swearing',
    profByMonth: '[Swearing by month]', worst: 'Roughest month', calmest: 'Calmest month',
    monthPct: (m, v) => `${MONTHS_EN[m - 1]} ${f1(v)}%`,
    badges: 'ACHIEVEMENTS', noBadge: ['Just Browsing', 'nothing unusual'],
    total: 'TOTAL', thanks: 'THANK YOU, COME AGAIN',
  },
  ko: {
    title: y => `${y} 연간 결산`,
    nickname: '닉네임', period: '기록 기간', issued: '발행',
    prompts: '보낸 프롬프트', sessions: '세션', folders: '작업 폴더',
    activeDays: '사용한 날', dailyAvg: '하루 평균', firstPrompt: '첫 프롬프트',
    streak: '최장 연속 사용', gap: '가장 길게 쉰 기간', busiestDay: '가장 많이 쓴 날', busiestHour: '가장 많이 쓴 1시간',
    count: n => `${fmt(n)}개`, days: n => `${n}일`, chars: n => `${fmt(n)}자`, times: n => `${fmt(n)}회`,
    grass: '잔디밭', perDay: '하루 프롬프트 수', orMore: n => `${n} 이상`,
    wdShort: [...'월화수목금토일'], wd: [...'월화수목금토일'], wdCols: 2,
    month: i => `${i + 1}월`, hourAxis: h => `${h}시`, hourFull: h => `${h}시`,
    range: (a, b) => `${a} ~ ${b}`, from: x => `${x}~`, longestVal: n => `${fmt(n)}개`, perSessionVal: v => `${f1(v)}개`,
    byMonth: '월별 프롬프트 수', byHour: '시간대별 프롬프트 수', byWeekday: '요일별 프롬프트 수',
    peakHour: '가장 많이 쓴 시간대', night: '새벽 0시 ~ 6시 비중', latest: '새벽에 가장 늦게 보낸 시각', weekend: '주말 비중',
    style: '일하는 방식', typed: '직접 친 글자 수', avgLen: '프롬프트당 평균 글자 수',
    short: '12자 이하 프롬프트 비율', hangul: '한글로 쓴 프롬프트 비율', pasted: '붙여넣기한 프롬프트 비율',
    perSession: '세션당 평균 프롬프트', longest: '가장 긴 세션의 프롬프트 수',
    parallel: '동시에 사용한 최대 세션 수', phrases: '[자주 쓴 짧은 프롬프트]', commands: '[많이 쓴 슬래시 명령]',
    models: n => `최근 ${n}일 사용 모델`, other: '기타',
    patience: '인내심 지표', correction: '"아니"로 시작한 프롬프트', profanity: '욕설이 포함된 프롬프트',
    profByMonth: '[월별 욕설 비율]', worst: '가장 험했던 달', calmest: '가장 평온했던 달',
    monthPct: (m, v) => `${m}월 ${f1(v)}%`,
    badges: '획득 칭호', noBadge: ['평범한 손님', '해당 조건 없음'],
    total: '합계', thanks: '이용해 주셔서 감사합니다',
  },
};

// 칭호 조건표. 조건을 만족하는 것을 이 순서대로 모두 찍는다. [조건, 영문 이름과 근거, 한글 이름과 근거]
const afterHours = d => Math.round((d.h.slice(18).reduce((a, b) => a + b, 0) + d.h.slice(0, 6).reduce((a, b) => a + b, 0)) / d.p * 1000) / 10;
const minorTool = d => (d.tools.length > 1 && d.bt ? d.bt.map(([tool, n]) => [tool, Math.round(n / d.p * 1000) / 10]).sort((a, b) => a[1] - b[1])[0] : null);
const cram = d => Math.round(d.bd[0] / d.pd * 10) / 10;
const BADGES = [
  // 시간
  [d => d.ns >= 15, ['Night Owl', d => `late night ${f1(d.ns)}% (15%+)`], ['올빼미', d => `새벽 ${f1(d.ns)}% (15%+)`]],
  [d => d.mrs >= 15, ['Early Bird', d => `morning ${f1(d.mrs)}% (15%+)`], ['미라클 모닝', d => `아침 ${f1(d.mrs)}% (15%+)`]],
  [d => d.ld && d.ld[0] >= '05:00', ['Saw the Sunrise', d => `still up at ${d.ld[0]} (05:00+)`], ['해 뜨는 거 봄', d => `새벽 ${d.ld[0]}까지 (05:00+)`]],
  [d => afterHours(d) < 10, ['Nine to Five', d => `after hours ${f1(afterHours(d))}% (under 10%)`], ['칼퇴', d => `퇴근 후 ${f1(afterHours(d))}% (10% 미만)`]],
  [d => d.ws >= 25, ['Weekend Warrior', d => `weekend ${f1(d.ws)}% (25%+)`], ['주말 전사', d => `주말 ${f1(d.ws)}% (25%+)`]],
  // 꾸준함
  [d => d.st[0] >= 14, ['Marathoner', d => `${d.st[0]}-day streak (14+)`], ['마라토너', d => `연속 ${d.st[0]}일 (14+)`]],
  [d => d.ar >= 70, ['Regular', d => `used on ${f1(d.ar)}% of days (70%+)`], ['단골', d => `사용한 날 ${f1(d.ar)}% (70%+)`]],
  [d => d.gp && d.gp[0] >= 14, ['Ghost', d => `${d.gp[0]} days away (14+)`], ['잠수', d => `${d.gp[0]}일 쉼 (14+)`]],
  [d => d.p >= 10000, ['VIP', d => `${fmt(d.p)} prompts (10,000+)`], ['VIP 고객', d => `프롬프트 ${fmt(d.p)}개 (10,000+)`]],
  // 몰아치기
  [d => d.bh[0] >= 60, ['Runaway Train', d => `${d.bh[0]} in one hour (60+)`], ['폭주기관차', d => `1시간 ${d.bh[0]}개 (60+)`]],
  [d => cram(d) >= 5, ['Crammer', d => `busiest day ${f1(cram(d))}x the average (5x+)`], ['벼락치기', d => `최다일이 평균의 ${f1(cram(d))}배 (5배+)`]],
  [d => d.ls >= 200, ['Last One Standing', d => `${fmt(d.ls)} in one session (200+)`], ['끝장 토론', d => `한 세션 ${fmt(d.ls)}개 (200+)`]],
  [d => d.pss >= 30, ['Deep Diver', d => `${f1(d.pss)} prompts per session (30+)`], ['한 우물', d => `세션당 ${f1(d.pss)}개 (30+)`]],
  // 일하는 방식
  [d => d.mp >= 5, ['Shadow Clone', d => `${d.mp} sessions at once (5+)`], ['분신술', d => `동시 세션 ${d.mp}개 (5+)`]],
  [d => d.pj >= 100, ['Collector', d => `${fmt(d.pj)} folders (100+)`], ['벌려놓기 장인', d => `작업 폴더 ${fmt(d.pj)}개 (100+)`]],
  [d => minorTool(d) && minorTool(d)[1] >= 30, ['Two-Timer', d => `${TOOL_NAMES[minorTool(d)[0]]} ${f1(minorTool(d)[1])}% (30%+)`], ['양다리', d => `${TOOL_NAMES[minorTool(d)[0]]} ${f1(minorTool(d)[1])}% (30%+)`]],
  [d => d.mo && d.mo.s[0][1] >= 95, ['Loyal', d => `${d.mo.s[0][0]} ${f1(d.mo.s[0][1])}% (95%+)`], ['일편단심', d => `${d.mo.s[0][0]} ${f1(d.mo.s[0][1])}% (95%+)`]],
  [d => d.ss >= 40, ['One-Liner', d => `short prompts ${f1(d.ss)}% (40%+)`], ['단답형', d => `12자 이하 ${f1(d.ss)}% (40%+)`]],
  [d => d.al >= 120, ['Novelist', d => `${d.al} chars on average (120+)`], ['소설가', d => `평균 ${d.al}자 (120+)`]],
  [d => d.ps >= 20, ['Ctrl+V', d => `pastes in ${f1(d.ps)}% (20%+)`], ['복붙 장인', d => `붙여넣기 ${f1(d.ps)}% (20%+)`]],
  [d => d.ph && d.ph[0] && d.ph[0][1] >= 100, ['Broken Record', d => `"${d.ph[0][0]}" ${fmt(d.ph[0][1])}x (100+)`], ['자동응답기', d => `"${d.ph[0][0]}" ${fmt(d.ph[0][1])}회 (100+)`]],
  [d => d.btw >= 50, ['Rabbit Hole', d => `/btw ${d.btw}x (50+)`], ['삼천포', d => `/btw ${d.btw}회 (50+)`]],
  [d => d.rw >= 50, ['Time Traveler', d => `/rewind ${d.rw}x (50+)`], ['시간여행자', d => `/rewind ${d.rw}회 (50+)`]],
  // 성격
  [d => d.co[1] >= 5, ["Devil's Advocate", d => `"no" ${f1(d.co[1])}% (5%+)`], ['아니무새', d => `"아니" ${f1(d.co[1])}% (5%+)`]],
  [d => d.pf[1] >= 3, ['Hothead', d => `swearing ${f1(d.pf[1])}% (3%+)`], ['다혈질', d => `욕설 ${f1(d.pf[1])}% (3%+)`]],
  [d => d.p >= 300 && d.pf[1] < 0.3, ['Zen', d => `swearing ${f1(d.pf[1])}% (under 0.3%)`], ['해탈', d => `욕설 ${f1(d.pf[1])}% (0.3% 미만)`]],
];

const measure = document.createElement('canvas').getContext('2d');

class Pen {
  constructor(ctx, T) {       // ctx가 없으면 높이만 잰다
    this.ctx = ctx;
    this.T = T;
    this.y = 30;
  }

  font(size) { return `${size * S}px ${FONT}`; }

  width(s, size = FS) {
    measure.font = this.font(size);
    return measure.measureText(s).width / S;
  }

  text(x, y, s, size = FS, bold = false, anchor = 'la', fill = INK) {
    const c = this.ctx;
    if (!c) return;
    c.font = this.font(size);
    c.fillStyle = fill;
    c.textBaseline = 'top';
    c.textAlign = anchor === 'ra' ? 'right' : anchor === 'ma' ? 'center' : 'left';
    c.fillText(s, Math.round(x * S), Math.round(y * S));
    if (bold) c.fillText(s, Math.round(x * S) + S, Math.round(y * S));   // 강조 인쇄
  }

  rect(x0, y0, x1, y1, fill = INK) {
    const c = this.ctx;
    if (!c) return;
    const X0 = Math.round(x0 * S), Y0 = Math.round(y0 * S);
    c.fillStyle = fill;
    c.fillRect(X0, Y0, Math.round(x1 * S) - X0, Math.round(y1 * S) - Y0);
  }

  dither(x0, y0, x1, y1, level) {   // 1비트 디더링, level 0~16
    if (!this.ctx) return;
    [x0, y0, x1, y1] = [x0, y0, x1, y1].map(Math.round);
    if (level >= 16) return this.rect(x0, y0, x1, y1);
    this.ctx.fillStyle = INK;
    for (let py = y0; py < y1; py++)
      for (let px = x0; px < x1; px++)
        if (BAYER[py % 4][px % 4] < level) this.ctx.fillRect(px * S, py * S, S, S);
  }

  center(s, size = FS, lh) {
    this.text(PAPER_W / 2, this.y, s, size, false, 'ma');
    this.y += lh || (size === FS ? LH : size + 6);
  }

  row(label, value = '', bold = false) {
    this.text(PM, this.y, label, FS, bold);
    if (value) {
      const fits = this.width(label) + this.width(value) + 12 <= PW;
      const size = fits ? FS : FS_SMALL;          // 한 줄에 안 들어가면 값만 작은 글꼴
      this.text(PM + PW, this.y + (FS - size), value, size, bold, 'ra');
    }
    this.y += LH;
  }

  rule(ch = '-') {
    this.text(PM, this.y, ch.repeat(COLS));
    this.y += LH;
  }

  band(title, note) {       // 반전 인쇄 제목줄
    this.y += 6;
    this.rect(PM, this.y - 3, PM + PW, this.y + FS + 3);
    this.text(PM + 12, this.y, title, FS, false, 'la', PAPER);
    if (note) this.text(PM + PW - 12, this.y + (FS - FS_SMALL), note, FS_SMALL, false, 'ra', PAPER);
    this.y += LH + 10;
  }

  gap(h = 10) { this.y += h; }
}

function heatmap(pen, d) {
  const year = d.y;
  const offset = (new Date(year, 0, 1).getDay() + 6) % 7;     // 월요일 = 0
  const ndays = d.d.length;
  const ncols = Math.floor((offset + ndays + 6) / 7);
  const lab = FS_SMALL + 6;
  const gx0 = PM + lab;
  const step = (PW - lab + 2) / ncols;                         // 마지막 칸 끝 = 인쇄폭 끝
  const xs = Array.from({ length: ncols + 1 }, (_, c) => Math.round(gx0 + c * step));
  const top = pen.y + FS_SMALL + 6;
  const ys = Array.from({ length: 8 }, (_, r) => Math.round(top + r * step));
  const dayIndex = (m, day) => Math.round((new Date(year, m, day) - new Date(year, 0, 1)) / 864e5);
  for (let m = 0; m < 12; m++) {                               // 각 달 구간의 가운데
    const a = offset + dayIndex(m, 1), b = offset + dayIndex(m + 1, 1);
    pen.text(gx0 + (a + b) / 2 / 7 * step, pen.y, String(m + 1), FS_SMALL, false, 'ma');
  }
  for (const r of [0, 2, 4, 6])
    pen.text(PM, ys[r] + (ys[r + 1] - ys[r] - FS_SMALL) / 2, pen.T.wdShort[r], FS_SMALL);
  const levels = [0, 4, 8, 12, 16];
  for (let i = 0; i < ndays; i++) {
    const lv = +d.d[i];
    if (!lv) continue;                                         // 안 쓴 날과 기록 없는 날은 공백
    const k = offset + i, c = Math.floor(k / 7), r = k % 7;
    pen.dither(xs[c], ys[r], xs[c + 1] - 2, ys[r + 1] - 2, levels[lv]);
  }
  pen.y = ys[7] + 10;
  const title = pen.T.perDay;
  pen.text(PM, pen.y, title, FS_SMALL);
  let lx = PM + pen.width(title, FS_SMALL) + 14;
  const q = d.q;
  const items = [[1, q[0]], [q[0] + 1, q[1]], [q[1] + 1, q[2]]]
    .map(([a, b], i) => [i + 1, a === b ? `${a}` : `${a}-${b}`, a <= b])
    .filter(x => x[2]);
  items.push([4, pen.T.orMore(q[2] + 1)]);
  for (const [lv, label] of items) {
    pen.dither(lx, pen.y + 2, lx + 12, pen.y + 14, levels[lv]);
    pen.text(lx + 17, pen.y, label, FS_SMALL);
    lx += 17 + pen.width(label, FS_SMALL) + 16;
  }
  pen.y += FS_SMALL + 14;
}

function columns(pen, values, labels, peakLabel, height = 80) {
  const present = values.filter(v => v !== null);
  const vmax = Math.max(...present) || 1;
  const n = values.length;
  const step = PW / n;
  const bw = Math.round(step * 0.66);
  const base = pen.y + FS_SMALL + 6 + height;
  let peak = 0;
  values.forEach((v, i) => { if ((v ?? -1) > (values[peak] ?? -1)) peak = i; });
  values.forEach((v, i) => {
    const x = Math.round(PM + i * step + (step - bw) / 2);
    if (labels[i]) pen.text(x + bw / 2, base + 6, labels[i], FS_SMALL, false, 'ma');
    if (v === null) return pen.rect(x + bw / 2 - 3, base - 4, x + bw / 2 + 3, base - 2);
    const h = Math.round(v / vmax * height);
    if (!h) return;
    if (i === peak) {
      pen.rect(x, base - h, x + bw, base);
      pen.text(x + bw / 2, base - h - FS_SMALL - 4, peakLabel(v), FS_SMALL, false, 'ma');
    } else {
      pen.dither(x, base - h, x + bw, base, 11);
    }
  });
  pen.rect(PM, base, PM + PW, base + 2);
  pen.y = base + FS_SMALL + 16;
}

function hbars(pen, values, labels, fmtValue, labCols = 2, valCols = 7) {
  const vmax = Math.max(...values) || 1;
  const peak = values.indexOf(vmax);
  const x0 = PM + labCols * FS / 2 + 12;
  const span = PW - (x0 - PM) - valCols * FS / 2 - 12;
  values.forEach((v, i) => {
    pen.text(PM, pen.y, labels[i], FS, i === peak);
    const w = Math.max(2, Math.round(v / vmax * span));
    if (i === peak) pen.rect(x0, pen.y + 5, x0 + w, pen.y + FS - 3);
    else pen.dither(x0, pen.y + 5, x0 + w, pen.y + FS - 3, 11);
    pen.text(PM + PW, pen.y, fmtValue(v), FS, i === peak, 'ra');
    pen.y += LH;
  });
  pen.y += 4;
}

function qrcodeBlock(pen, url) {
  // 주소의 # 앞은 바이트 모드, 뒤는 영숫자 모드로 담는다
  const at = url.indexOf('#') + 1;
  const q = qrcode(0, 'M');
  q.addData(url.slice(0, at), 'Byte');
  q.addData(url.slice(at), 'Alphanumeric');
  q.make();
  const n = q.getModuleCount(), quiet = 4;
  const mod = Math.min(6, Math.floor(PW / (n + 2 * quiet)));
  const size = (n + 2 * quiet) * mod;
  const x0 = Math.round(PM + (PW - size) / 2) + quiet * mod;
  const y0 = pen.y + quiet * mod;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (q.isDark(r, c)) pen.rect(x0 + c * mod, y0 + r * mod, x0 + (c + 1) * mod, y0 + (r + 1) * mod);
  pen.y += size;
  return n;
}

function layout(pen, d, url, check) {
  const T = pen.T, ko = T === L.ko;
  const sc = d.sc || [], ph = d.ph || [];
  const range = T.range;
  pen.center(d.tools.map(x => TOOL_NAMES[x].toUpperCase()).join(' + '));
  pen.gap(4);
  pen.center(T.title(d.y), FS * 2, FS * 2 + 14);
  pen.rule();
  pen.row(T.nickname, d.n);
  pen.row(T.period, range(d.f, d.e));
  pen.row(T.issued, d.iss);
  pen.rule();
  pen.row(T.prompts, T.count(d.p), true);
  if (d.tools.length > 1 && d.bt) for (const [tool, n] of d.bt) pen.row('  ' + TOOL_NAMES[tool], T.count(n));
  pen.row(T.sessions, T.count(d.s));
  pen.row(T.folders, T.count(d.pj));
  pen.row(T.activeDays, `${T.days(d.ad)} (${f1(d.ar)}%)`);
  pen.row(T.dailyAvg, T.count(d.pd));
  pen.row(T.firstPrompt, d.fp);
  pen.row(T.streak, `${T.days(d.st[0])} (${range(d.st[1], d.st[2])})`);
  if (d.gp) pen.row(T.gap, `${T.days(d.gp[0])} (${range(d.gp[1], d.gp[2])})`);
  pen.row(T.busiestDay, `${T.count(d.bd[0])} (${d.bd[1]})`);
  pen.row(T.busiestHour, `${T.count(d.bh[0])} (${T.from(d.bh[1])})`);

  pen.band(T.grass);
  heatmap(pen, d);

  pen.band(T.byMonth);
  columns(pen, d.mc, d.mc.map((_, i) => T.month(i)), v => T.count(v));

  pen.band(T.byHour);
  columns(pen, d.h, d.h.map((_, h) => (h % 6 === 0 ? T.hourAxis(h) : '')), v => T.count(v));
  pen.row(T.peakHour, T.hourFull(d.h.indexOf(Math.max(...d.h))));
  pen.row(T.night, `${f1(d.ns)}%`);
  if (d.ld) pen.row(T.latest, `${d.ld[0]} (${d.ld[1]})`);

  pen.band(T.byWeekday);
  hbars(pen, d.w, T.wd, v => T.count(v), T.wdCols, 8);
  pen.row(T.weekend, `${f1(d.ws)}%`);

  pen.band(T.style);
  pen.row(T.typed, T.chars(d.tc));
  pen.row(T.avgLen, T.chars(d.al));
  pen.row(T.short, `${f1(d.ss)}%`);
  if (d.hs > 0) pen.row(T.hangul, `${f1(d.hs)}%`);   // 한글을 안 쓰면 줄을 뺀다
  if (d.ps != null) pen.row(T.pasted, `${f1(d.ps)}%`);     // 도구에 따라 없는 값
  pen.row(T.perSession, T.perSessionVal(d.pss));
  pen.row(T.longest, T.longestVal(d.ls));
  pen.row(T.parallel, T.count(d.mp));
  if (ph.length) {
    pen.row(T.phrases);
    for (const [k, v] of ph) pen.row('  ' + k, T.times(v));
  }
  if (sc.length) {
    pen.row(T.commands);
    for (const [k, v] of sc) pen.row('  ' + k, T.times(v));
  }

  if (d.mo) {
    pen.band(T.models(d.mo.d));
    const names = d.mo.s.map(x => (x[0] === 'Other' ? T.other : x[0]));
    const cols = Math.max(10, ...names.map(n => Math.ceil(pen.width(n) / (FS / 2))));
    hbars(pen, d.mo.s.map(x => x[1]), names, v => `${f1(v)}%`, cols, 6);
  }

  pen.band(T.patience);
  pen.row(T.correction, `${T.count(d.co[0])} (${f1(d.co[1])}%)`);
  pen.row(T.profanity, `${T.count(d.pf[0])} (${f1(d.pf[1])}%)`);
  pen.gap(6);
  pen.row(T.profByMonth);
  columns(pen, d.pm, d.pm.map((_, i) => T.month(i)), v => `${f1(v)}%`, 64);
  if (d.wm) pen.row(T.worst, T.monthPct(d.wm[0], d.wm[1]));
  if (d.cm) pen.row(T.calmest, T.monthPct(d.cm[0], d.cm[1]));

  pen.band(T.badges);
  const got = BADGES.filter(([cond]) => cond(d)).map(b => { const [name, why] = b[ko ? 2 : 1]; return [name, why(d)]; });
  for (const [name, why] of got.length ? got : [T.noBadge]) pen.row('* ' + name, why);

  pen.rule('=');
  pen.text(PM, pen.y, T.total, FS * 2);
  pen.text(PM + PW, pen.y, `${fmt(d.p)} PROMPTS`, FS * 2, false, 'ra');
  pen.y += FS * 2 + 10;
  pen.rule('=');
  pen.gap(12);
  pen.center(url.split('#')[0].replace(/\/$/, ''));      // 페이지 주소는 QR 위에 기본 글꼴로
  qrcodeBlock(pen, url);
  pen.center(`${check.slice(0, 4)}-${check.slice(4)}`, FS_SMALL);
  pen.gap(12);
  pen.center(T.thanks);
  pen.gap(24);
}

function threshold(canvas) {    // 감열지처럼 1비트로
  const c = canvas.getContext('2d');
  const img = c.getImageData(0, 0, canvas.width, canvas.height);
  const p = img.data;
  const ink = [0x16, 0x16, 0x16], paper = [0xfd, 0xfd, 0xfb];
  for (let i = 0; i < p.length; i += 4) {
    const dark = p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114 < 128;
    const col = dark ? ink : paper;
    p[i] = col[0]; p[i + 1] = col[1]; p[i + 2] = col[2]; p[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
}

function compose(paper) {
  const pw = paper.width, ph = paper.height, P = PAD * S;
  const out = document.createElement('canvas');
  out.width = pw + 2 * P;
  out.height = ph + 2 * P;
  const c = out.getContext('2d');
  c.fillStyle = BG;
  c.fillRect(0, 0, out.width, out.height);
  const tooth = 12 * S, depth = 5 * S;
  const path = new Path2D();
  path.moveTo(P, P + depth);
  for (let x = 0, up = true; x < pw; up = !up) {
    x = Math.min(x + tooth / 2, pw);
    path.lineTo(P + x, P + (up ? 0 : depth));
  }
  path.lineTo(P + pw, P + ph - depth);
  for (let x = pw, up = true; x > 0; up = !up) {
    x = Math.max(x - tooth / 2, 0);
    path.lineTo(P + x, P + (up ? ph : ph - depth));
  }
  path.closePath();
  c.save();
  c.shadowColor = 'rgba(100, 104, 112, 0.5)';
  c.shadowBlur = 18 * S;
  c.shadowOffsetY = 5 * S;
  c.fillStyle = PAPER;
  c.fill(path);
  c.restore();
  c.save();
  c.clip(path);
  c.drawImage(paper, P, P);
  c.restore();
  return out;
}

async function renderReceipt(d, url, check, lang) {
  const T = L[lang] || L.en;
  d = derive(d);
  await Promise.all([16, 24, 48].map(s => document.fonts.load(`${s * S}px ${FONT}`, '가A')));
  const dry = new Pen(null, T);
  layout(dry, d, url, check);
  const paper = document.createElement('canvas');
  paper.width = PAPER_W * S;
  paper.height = Math.round(dry.y * S);
  const ctx = paper.getContext('2d');
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, paper.width, paper.height);
  layout(new Pen(ctx, T), d, url, check);
  threshold(paper);
  return compose(paper);
}
