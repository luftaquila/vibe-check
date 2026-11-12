const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validate, parseHandoff, stamp, encode, decode, modelName, derive, ReceiptError } = require('../core.js');
const { input, expected } = require('./fixture.json');

const clone = () => structuredClone(input);
const handoff = d => '#j=' + Buffer.from(JSON.stringify(d)).toString('base64url');
const rejects = (d, key) => assert.throws(() => validate(d), e => e instanceof ReceiptError && e.key === key);

test('derive: 기준 구현과 같은 값을 계산한다', () => {
  const out = derive(clone());
  for (const [k, v] of Object.entries(expected)) assert.deepEqual(out[k], v, k);
});

test('derive: 지난 연도 영수증은 12월 31일에서 끝난다', () => {
  const d = clone();
  d.iss = '2027-01-05 10:00';
  assert.equal(derive(d).e, '2026-12-31');
});

test('derive: 모델 건수를 이름별로 묶고 상위 4개와 Other를 만든다', () => {
  const d = clone();
  d.mo = [['claude-opus-5-5', 900], ['us.anthropic.claude-opus-5-5-v1:0', 50], ['claude-fable-5-2', 30],
    ['claude-sonnet-5-5', 10], ['claude-haiku-5-5', 6], ['claude-3-5-sonnet-20241022', 4]];
  assert.deepEqual(derive(d).mo, [{ tool: 'claude-code', d: 30, r: 1000,
    s: [['Opus 5.5', 95], ['Fable 5.2', 3], ['Sonnet 5.5', 1], ['Haiku 5.5', 0.6], ['Other', 0.4]] }]);
});

test('modelName', () => {
  const cases = {
    'claude-opus-5-5': 'Opus 5.5',
    'claude-haiku-5': 'Haiku 5',
    'claude-opus-4-20250514': 'Opus 4',
    'claude-sonnet-4-5-20250929': 'Sonnet 4.5',
    'claude-3-5-sonnet-20241022': 'Sonnet 3.5',
    'us.anthropic.claude-opus-4-8-v1:0': 'Opus 4.8',
    'claude-opus-4-8@20260101': 'Opus 4.8',
    'gpt-6-astra': 'gpt-6-astra',
    'codex-auto-review': 'codex-auto-review',
    'some-very-long-unknown-model': 'some-very-long-unk',
  };
  for (const [id, name] of Object.entries(cases)) assert.equal(modelName(id), name, id);
});

test('주소: 넘겨받은 값 → 정식 주소 → 복원', async () => {
  const data = stamp(parseHandoff(handoff(clone())), new Date(2026, 10, 12, 18, 0));
  assert.equal(data.iss, '2026-11-12 18:00');
  const { hash, check } = await encode(data);
  assert.match(hash, /^#1\.[0-9A-F]{8}\.[A-Za-z0-9_-]+$/);
  const back = await decode(hash);
  assert.deepEqual(back.data, data);
  assert.equal(back.check, check);
  assert.equal(back.ok, true);
});

test('주소: 내용을 고치면 검증 번호가 맞지 않는다', async () => {
  const data = stamp(clone(), new Date(2026, 10, 12));
  const { check } = await encode(data);
  const forged = await encode({ ...data, p: 99999 });
  const back = await decode(forged.hash.replace(forged.check, check));
  assert.equal(back.ok, false);
});

test('주소: 잘리거나 형식이 다르면 거절한다', async () => {
  const { hash } = await encode(stamp(clone(), new Date(2026, 10, 12)));
  await assert.rejects(decode(hash.slice(0, -40)), e => e.key === 'eUnpack');
  await assert.rejects(decode('#hello'), e => e.key === 'eFormat');
  assert.throws(() => parseHandoff('#j=not-json'), e => e.key === 'eIngest');
});

test('validate: 정상 값은 통과한다', () => validate(clone()));

test('validate: Codex만 고르면 붙여넣기와 슬래시 항목이 없어도 통과한다', () => {
  const d = clone();
  d.src = ['codex'];
  for (const k of ['ps', 'sl', 'sc', 'btw', 'rw']) delete d[k];
  validate(d);
  assert.deepEqual(derive(d).tools, ['codex']);
});

test('validate: 도구 목록과 도구별 값을 확인한다', () => {
  let d = clone(); d.src = ['claude-code', 'codex']; d.bt = [['claude-code', 6000], ['codex', 2641]];
  d.mo = { 'claude-code': [['claude-opus-5-5', 10]], codex: [['gpt-6-astra', 5]] };
  validate(d);
  d = clone(); d.src = ['other-tool']; rejects(d, 'eInvalid');
  d = clone(); d.src = []; rejects(d, 'eInvalid');
  d = clone(); d.src = ['codex', 'codex']; rejects(d, 'eInvalid');
  d = clone(); d.src = ['codex']; d.bt = [['claude-code', 1]]; rejects(d, 'eInvalid');
  d = clone(); d.src = ['codex']; d.mo = { 'claude-code': [['x', 1]] }; rejects(d, 'eInvalid');
});

test('derive: 두 도구를 합친 영수증은 모델 비율을 도구별로 낸다', () => {
  const d = clone();
  d.src = ['claude-code', 'codex'];
  d.mo = { 'claude-code': [['claude-opus-5-5', 90], ['claude-haiku-5-5', 10]], codex: [['gpt-6-astra', 3], ['gpt-6-sol', 1]] };
  const out = derive(d);
  assert.deepEqual(out.tools, ['claude-code', 'codex']);
  assert.deepEqual(out.mo, [
    { tool: 'claude-code', d: 30, r: 100, s: [['Opus 5.5', 90], ['Haiku 5.5', 10]] },
    { tool: 'codex', d: 30, r: 4, s: [['gpt-6-astra', 75], ['gpt-6-sol', 25]] },
  ]);
});

test('prompt.md: 두 도구의 기록 위치와 영수증 언어 줄이 있다', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'prompt.md'), 'utf8');
  for (const s of ['~/.claude/history.jsonl', '~/.codex/history.jsonl', '| `lg` | `"en"` |', '# Rules', '| `bt` |'])
    assert.ok(text.includes(s), s);
  assert.doesNotMatch(text, /<!--/);
});

test('validate: 빠지거나 틀린 값을 거절한다', () => {
  let d = clone(); delete d.h; rejects(d, 'eMissing');
  d = clone(); d.w = [1, 2, 3]; rejects(d, 'eArray');
  d = clone(); d.d = d.d.slice(0, 100); rejects(d, 'eGrid');
  d = clone(); d.n = 'x'.repeat(21); rejects(d, 'eNick');
  d = clone(); d.n = '名前'; rejects(d, 'eNick');
  d = clone(); d.n = 'vibe 😎'; rejects(d, 'eNick');
  d = clone(); d.n = '루프트 aquila_01'; validate(d);
  d = clone(); d.v = 2; rejects(d, 'eVersion');
  d = clone(); d.p = -1; rejects(d, 'eInvalid');
  d = clone(); d.h[3] = 'many'; rejects(d, 'eInvalid');
  d = clone(); d.fp = 'yesterday'; rejects(d, 'eInvalid');
});

test('validate: 목록 개수와 길이를 제한한다', () => {
  let d = clone(); d.ph = Array.from({ length: 6 }, (_, i) => ['a' + i, 9]); rejects(d, 'eInvalid');
  d = clone(); d.ph = [['x'.repeat(13), 9]]; rejects(d, 'eInvalid');
  d = clone(); d.ph = [['はい', 9]]; rejects(d, 'eInvalid');
  d = clone(); d.sc = Array.from({ length: 500 }, (_, i) => ['/c' + i, 1]); rejects(d, 'eInvalid');
  d = clone(); d.mo = [['m'.repeat(81), 1]]; rejects(d, 'eInvalid');
  assert.throws(() => parseHandoff('#j=' + 'A'.repeat(30000)), e => e.key === 'eInvalid');
});
