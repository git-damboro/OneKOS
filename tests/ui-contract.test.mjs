import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('首页提供当前七个演示页面和模拟数据标识', async () => {
  const html = await readFile(path.join(root, 'public', 'index.html'), 'utf8');

  for (const label of ['AI 内容工作台', '动态顾问画像', '机会雷达与选题', '内容创作室', '矩阵调度与质检', '评论运营中心', '线索与策略学习']) {
    assert.match(html, new RegExp(label));
  }
  assert.match(html, /模拟演示数据/);
  assert.match(html, /rel="icon"/);
  assert.match(html, /type="module" src="\.\/app-v2\.js"/);
});

test('界面脚本包含完整链路动作并调用规则引擎', async () => {
  const source = await readFile(path.join(root, 'public', 'app-v2.js'), 'utf8');

  assert.match(source, /analyzeSignals/);
  assert.match(source, /routeTopics/);
  assert.match(source, /runFourChecks/);
  for (const action of ['calibrate', 'route-topics', 'generate-content', 'resolve-matrix', 'publish', 'extract-leads', 'reset']) {
    assert.match(source, new RegExp(action));
  }
});

test('视觉样式覆盖桌面与移动端', async () => {
  const css = await readFile(path.join(root, 'public', 'styles-v2.css'), 'utf8');

  assert.match(css, /@media\s*\(max-width:\s*900px\)/);
  assert.match(css, /@media\s*\(max-width:\s*620px\)/);
  assert.match(css, /\.sidebar/);
  assert.match(css, /\.metric/);
});
