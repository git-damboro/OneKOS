import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzeCommentLead, applyConfirmedFeedback, inspectContentPackage } from '../src/live-engine.mjs';

const activeKnowledge = [{ knowledgeId: 'KB-1', status: '有效', validUntil: '2099-12-31' }];
const tags = [{ tagId: 'TAG-1', status: '生效', weight: 80, confidence: 90 }];

test('四重质检拒绝不存在的事实引用和绝对化承诺', () => {
  const result = inspectContentPackage({
    content: {
      title: '全网第一的补能方案', hook: '保证每周只充一次', script: '这是确定答案。',
      factRefs: ['KB-MISSING'], profileRefs: ['TAG-1'],
    },
    knowledge: activeKnowledge,
    profileTags: tags,
    matrixContents: [],
  });

  assert.equal(result.passed, false);
  assert.ok(result.fact.score < 80);
  assert.ok(result.compliance.score < 80);
  assert.ok(result.issues.some((issue) => issue.includes('KB-MISSING')));
});

test('画像引用有效且矩阵空白时通过质检', () => {
  const result = inspectContentPackage({
    content: {
      title: '成都晚高峰补能路线实测计划', hook: '先记录，再给答案',
      script: '等待时间和电量变化由顾问完成五天实拍后补充。',
      factRefs: [], profileRefs: ['TAG-1'],
    },
    knowledge: activeKnowledge,
    profileTags: tags,
    matrixContents: [{ title: '六口之家第三排上下车体验', hook: '带老人孩子实测', script: '空间体验' }],
  });
  assert.equal(result.passed, true);
  assert.ok(result.persona.score >= 90);
  assert.equal(result.matrix.risk, '低');
});

test('回声室探测器识别近重复内容', () => {
  const result = inspectContentPackage({
    content: {
      title: '成都晚高峰补能路线实测', hook: '没有家充先跑一遍', script: '记录等待时间和补能耗时', factRefs: [], profileRefs: ['TAG-1'],
    },
    knowledge: activeKnowledge,
    profileTags: tags,
    matrixContents: [{ title: '成都晚高峰补能路线实测', hook: '没有家充先跑一遍', script: '记录等待时间和补能耗时' }],
  });
  assert.equal(result.matrix.risk, '高');
  assert.equal(result.passed, false);
  assert.ok(result.matrix.similarity >= 0.8);
});

test('评论识别生成 A 级线索但保持人工接管', () => {
  const lead = analyzeCommentLead({
    commentId: 'COMMENT-1',
    text: '我在成都高新区，家里两个孩子，最近一个月准备换车，想看乐道 L60，这周六能试驾吗？',
    platform: '抖音（模拟）',
    likes: 36,
  });
  assert.equal(lead.city, '成都高新区');
  assert.equal(lead.familyStructure, '二孩家庭');
  assert.equal(lead.model, '乐道 L60');
  assert.equal(lead.grade, 'A');
  assert.equal(lead.status, '待顾问人工接管');
  assert.equal(lead.automationAllowed, false);
});

test('反馈事件只有人工确认后才调整画像权重', () => {
  const event = { eventId: 'EVENT-1', affectedTagId: 'TAG-1', weightDelta: 6, status: '待顾问确认后学习' };
  const pending = applyConfirmedFeedback(tags, event, false);
  assert.equal(pending.tags[0].weight, 80);
  assert.equal(pending.event.status, '待顾问确认后学习');

  const confirmed = applyConfirmedFeedback(tags, event, true);
  assert.equal(confirmed.tags[0].weight, 86);
  assert.equal(confirmed.event.status, '已确认并学习');
});
