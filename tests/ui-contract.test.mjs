import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('首页提供七个演示页面和模拟数据标识', async () => {
  const html = await readFile(path.join(root, 'public', 'index.html'), 'utf8');

  for (const label of ['运营驾驶舱', '抖音评论洞察', '智能选题', '脚本工作台', '四重质检', '模拟发布', '评论转线索']) {
    assert.match(html, new RegExp(label));
  }
  assert.match(html, /模拟演示数据/);
  assert.match(html, /rel="icon"/);
  assert.match(html, /type="module" src="\.\/app\.js"/);
});

test('界面脚本包含完整链路动作并调用规则引擎', async () => {
  const source = await readFile(path.join(root, 'public', 'app.js'), 'utf8');

  assert.match(source, /analyzeComments/);
  assert.match(source, /rankTopics/);
  assert.match(source, /canPublish/);
  for (const action of ['generate-topics', 'generate-script', 'run-quality', 'apply-optimization', 'simulate-publish', 'extract-leads', 'reset-demo']) {
    assert.match(source, new RegExp(action));
  }
});

test('视觉样式覆盖桌面与移动端', async () => {
  const css = await readFile(path.join(root, 'public', 'styles.css'), 'utf8');

  assert.match(css, /@media\s*\(max-width:\s*1024px\)/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)/);
  assert.match(css, /\.sidebar/);
  assert.match(css, /\.metric-card/);
});
