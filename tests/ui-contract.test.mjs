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

test('界面脚本包含完整链路动作并调用业务服务与规则引擎', async () => {
  const source = await readFile(path.join(root, 'public', 'app-v2.js'), 'utf8');

  assert.match(source, /analyzeSignals/);
  assert.match(source, /routeOpportunities/);
  assert.match(source, /runFourChecks/);
  for (const action of ['calibrate', 'route-opportunities', 'accept-opportunity', 'generate-content', 'resolve-matrix', 'publish', 'extract-leads', 'reset']) {
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

test('首页提供飞书落地中心并展示推荐架构与实施边界', async () => {
  const html = await readFile(path.join(root, 'public', 'index.html'), 'utf8');
  const source = await readFile(path.join(root, 'public', 'app-v2.js'), 'utf8');

  assert.match(html, /飞书落地中心/);
  assert.match(source, /renderFeishuImplementation/);
  for (const phrase of ['飞书多维表格', 'Aily', '机器人卡片', '七张数据表', '五项 Agent 技能', '四条工作流', '真实实现', '模拟输入']) {
    assert.match(source, new RegExp(phrase));
  }
});

test('界面展示运行模式并通过服务 API 执行生成、评论和学习闭环', async () => {
  const html = await readFile(path.join(root, 'public', 'index.html'), 'utf8');
  const source = await readFile(path.join(root, 'public', 'app-v2.js'), 'utf8');
  const apiClient = await readFile(path.join(root, 'public', 'api-client.js'), 'utf8');

  assert.match(html, /id="runtime-status"/);
  assert.match(source, /getDemoState/);
  assert.match(source, /generateContent/);
  assert.match(source, /analyzeComment/);
  assert.match(source, /confirmFeedback/);
  assert.match(source, /live|hybrid|simulation/);
  for (const endpoint of ['/api/demo/state', '/api/content/generate', '/api/comments/analyze', '/confirm']) {
    assert.match(apiClient, new RegExp(endpoint.replaceAll('/', '\\/')));
  }
});

test('内容创作室按素材槽位上传并在后台异步检查', async () => {
  const source = await readFile(path.join(root, 'public', 'app-v2.js'), 'utf8');
  const apiClient = await readFile(path.join(root, 'public', 'api-client.js'), 'utf8');
  const css = await readFile(path.join(root, 'public', 'styles-v2.css'), 'utf8');

  for (const phrase of ['上传后后台检查', '后台检查中', 'select-material', 'materialFileInput', 'selectedMaterialSlotId', 'readMediaMetadata', 'applyMaterialResult', 'pollMaterialCheck', 'materialOperations']) assert.match(source, new RegExp(phrase));
  for (const method of ['getAdvisorProfile', 'getAdvisorWorkspace', 'getContentPackage', 'getContentMaterials', 'uploadAsset', 'startEditingJob', 'getEditingJob']) assert.match(apiClient, new RegExp(method));
  for (const phrase of ['正在生成可拍摄内容包', 'recoverContentPackage', '已从飞书恢复生成结果']) assert.match(source, new RegExp(phrase));
  for (const phrase of ['resumeAdvisorWorkspace', 'contentIdForTask', '已经接收的任务', 'open-accepted-task', 'back-accepted-tasks', 'generateStudioContent', '当前尚无内容成果，点击后直接生成', 'materialRequestSequence']) assert.match(source, new RegExp(phrase));
  for (const phrase of ['workspaceLoading', 'workspaceRequestSequence', 'clearAdvisorWorkspace', '正在读取当前顾问的已接收任务']) assert.match(source, new RegExp(phrase));
  for (const phrase of ['loadExistingAdvisorProfile', 'clearAdvisorQuizState', '已有顾问画像', '不再重复进入基础问卷']) assert.match(source, new RegExp(phrase));
  assert.match(css, /\.workspace-spinner/);
  assert.match(css, /@keyframes workspace-spin/);
  assert.match(apiClient, /generateContent:[\s\S]*timeoutMs: 90_000/);
  assert.match(css, /\.material-upload-button/);
  assert.match(source, /不能超过 100MB/);
  assert.match(css, /\.material-file-picker/);
  assert.match(css, /\.material-upload-row\.checking/);
  assert.match(source, /生成预览视频/);
  assert.match(source, /请先补齐素材/);
  assert.match(source, /material-video-action/);
  assert.match(source, /<button class="primary" data-page="quality">查看内容质检/);
  assert.match(css, /\.material-video-action/);
  assert.match(source, /pollEditingJob/);
  assert.match(css, /\.editing-preview/);
});

test('画像页提供可恢复的一题一屏问卷和可纠偏词云', async () => {
  const source = await readFile(path.join(root, 'public', 'app-v2.js'), 'utf8');
  const apiClient = await readFile(path.join(root, 'public', 'api-client.js'), 'utf8');
  const css = await readFile(path.join(root, 'public', 'styles-v2.css'), 'utf8');

  for (const phrase of [
    '一题一屏', '基础问卷', '自适应追问', '情景判断', '短文表达题',
    '词云画像', '画像词', '置信度', '来源', '证据', '删除词语', '降低权重', '锁定词语', '进入机会雷达',
  ]) {
    assert.match(source, new RegExp(phrase));
  }
  for (const action of [
    'select-advisor', 'back-advisor-selection', 'create-quiz-session', 'resume-quiz', 'abandon-quiz-session', 'submit-quiz-answer', 'previous-quiz-question',
    'complete-quiz', 'select-cloud-word', 'remove-cloud-word', 'lower-cloud-word', 'lock-cloud-word', 'confirm-word-cloud',
  ]) {
    assert.match(source, new RegExp(action));
  }
  for (const method of [
    'listAdvisors', 'createQuizSession', 'getQuizSession', 'submitQuizAnswer', 'completeQuizSession', 'confirmQuizSession',
  ]) {
    assert.match(apiClient, new RegExp(method));
  }
  assert.match(source, /localStorage/);
  for (const phrase of ['resumableSession', 'updateAdvisorBadge', 'quiz-create', 'quiz-confirm', '删除未完成画像']) assert.match(source, new RegExp(phrase));
  assert.match(apiClient, /abandonQuizSession/);
  assert.doesNotMatch(source, /Promise\.all\(\[loadAdvisors\(\), resumeQuizSession\(\)\]\)/);
  assert.match(css, /\.quiz-card/);
  assert.match(css, /\.profile-word-cloud/);
  assert.match(css, /\.cloud-word/);
  assert.match(css, /\.word-detail/);
});

test('机会雷达从服务端读取真实业务记录并持久化顾问决策', async () => {
  const source = await readFile(path.join(root, 'public', 'app-v2.js'), 'utf8');
  const apiClient = await readFile(path.join(root, 'public', 'api-client.js'), 'utf8');
  const css = await readFile(path.join(root, 'public', 'styles-v2.css'), 'utf8');

  for (const phrase of ['实际任务池', '评论需求信号', '历史内容库', '画像证据', '拒绝原因']) {
    assert.match(source, new RegExp(phrase));
  }
  for (const action of ['route-opportunities', 'accept-opportunity', 'reject-opportunity']) {
    assert.match(source, new RegExp(action));
  }
  for (const method of ['getOpportunities', 'routeOpportunities', 'decideOpportunity']) {
    assert.match(apiClient, new RegExp(method));
  }
  assert.match(source, /item\.decision === 'accept'/);
  assert.doesNotMatch(source, /平台趋势<\/span><strong>\+18%/);
  assert.doesNotMatch(source, /矩阵空白<\/span><strong>3<\/strong>/);
  assert.match(css, /\.score-breakdown/);
  assert.match(css, /\.topic-actions/);
  assert.match(source, /renderProfileEvidence/);
  assert.match(source, /还有 \$\{hidden\.length\} 项/);
  assert.match(css, /\.chip-overflow/);
});
