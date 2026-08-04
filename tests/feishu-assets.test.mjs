import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFile(path.join(root, relative), 'utf8');

test('Aily 系统提示词覆盖个性化、事实门禁、矩阵治理和人工边界', async () => {
  const prompt = await read('feishu/aily/OneKOS-Agent系统提示词.md');

  for (const phrase of ['动态内容 DNA', '事实核＋人格壳', '四重质检', '回声室', '低置信度', '保持为空', '人工接管']) {
    assert.match(prompt, new RegExp(phrase));
  }
  for (const contract of ['profile_calibration', 'daily_topic_route', 'content_package_generate', 'quality_and_matrix_check', 'comment_to_lead']) {
    assert.match(prompt, new RegExp(contract));
  }
  assert.match(prompt, /JSON/);
});

test('工作流清单给出四条可配置流程的触发、读写、异常和权限', async () => {
  const guide = await read('feishu/aily/工作流配置清单.md');

  for (const workflow of ['WF-01', 'WF-02', 'WF-03', 'WF-04']) assert.match(guide, new RegExp(workflow));
  for (const requirement of ['触发器', '读取字段', '写回字段', '失败处理', '人工边界']) assert.match(guide, new RegExp(requirement));
});

test('机器人卡片模板可以解析且不包含自动联系客户动作', async () => {
  for (const filename of ['今日任务卡片.json', '高意向线索卡片.json']) {
    const source = await read(`feishu/cards/${filename}`);
    const card = JSON.parse(source);
    assert.equal(card.schema, '2.0');
    assert.ok(card.header?.title?.content);
    assert.ok(Array.isArray(card.body?.elements));
    assert.doesNotMatch(source, /自动私信|自动呼叫|自动发布/);
  }
});
