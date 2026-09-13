/* Build the real export in isolation, then exercise its real study API offline. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'jodal-pack-test-'));
after(() => fs.rmSync(output, { recursive: true, force: true }));
const built = spawnSync(process.env.PYTHON || 'python', ['-X', 'utf8', 'tools/pack_standalone.py'], {
  cwd: root, env: { ...process.env, PPM_OUT: root, PPM_PACK: output }, encoding: 'utf8',
});
assert.equal(built.status, 0, built.error?.message || built.stderr || built.stdout);
const read = name => fs.readFileSync(path.join(output, name), 'utf8');

test('standalone exports inline every local stylesheet and script, including new UI assets', () => {
  const files = fs.readdirSync(output).filter(name => name.endsWith('.html'));
  assert.ok(files.length >= 16);
  for (const name of files) {
    const html = read(name);
    assert.ok(!/<(?:script|link)\b[^>]*\s(?:src|href)="(?:\.\.\/)*assets\//.test(html), name + ': unpacked local asset');
    for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
      assert.doesNotThrow(() => new vm.Script(script[1], { filename: name }));
    }
  }
  assert.match(read('학습방.html'), /data-packed-src="assets\/home\.js"/);
  assert.match(read('학습계획.html'), /data-packed-src="assets\/plan\.js"/);
  assert.match(read('익히기_목차.html'), /data-packed-src="assets\/catalog\.js"/);
  assert.match(read('학습방.html'), /\.home-hero\{/);
});

test('packed drill and CBT load all current subject data without a network request', async () => {
  for (const name of ['외우기.html', '모의시험.html']) {
    const html = read(name), listeners = {};
    let requests = 0;
    const context = vm.createContext({
      Promise, Set, AbortController, setTimeout, clearTimeout,
      localStorage: { getItem: () => null, setItem() {} },
      document: { addEventListener(event, fn) { listeners[event] = fn; } },
      fetch() { requests++; throw new Error('Network unavailable in standalone export'); },
    });
    context.window = context;
    for (const pattern of [
      /<script data-packed-src="assets\/quiz\.js">([\s\S]*?)<\/script>/,
      /<script data-packed-data="true">([\s\S]*?)<\/script>/,
    ]) {
      const match = html.match(pattern);
      assert.ok(match, name + ': missing packed runtime/data adapter');
      vm.runInContext(match[1], context);
    }
    assert.equal(context.PPMQ.SUBJECTS.length, 4);
    for (const slug of ['law', 'plan', 'contract', 'practice']) {
      for (const [kind, method, field] of [['quiz', 'loadQuiz', 'items'], ['cards', 'loadCards', 'cards']]) {
        const expected = JSON.parse(fs.readFileSync(path.join(root, 'data', `${kind}.${slug}.json`), 'utf8'));
        const actual = await context.PPMQ[method](slug);
        assert.equal(actual.n, expected.n);
        assert.equal(actual[field].length, expected[field].length);
        assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);
      }
    }
    await assert.rejects(context.PPMQ.loadQuiz('missing'), /없는 과목/);
    assert.equal(requests, 0);
    const dynamic = { href: '', getAttribute: () => '../c/W1.1.1/#A0001' };
    listeners.click({ target: { closest: () => dynamic } });
    assert.equal(dynamic.href, 'https://jodal.pro/c/W1.1.1/#A0001');
  }
});

test('packed links use portable paths and preserve actual concept destinations', () => {
  assert.match(read('학습계획.html'), /href="외우기\.html\?subject=/);
  assert.match(read('익히기_목차.html'), /href="익히기_공공계약법령\.html"/);
  assert.match(read('익히기_목차.html'), /href="https:\/\/jodal\.pro\/c\/W1\.1\.1\/"/);
});
