import assert from 'node:assert/strict';
import test from 'node:test';

import { decideOpportunity, routeOpportunities } from '../src/opportunity-router.mjs';

const profileTags = [
  { tagId: 'TAG-LOCAL', label: '成都本地', weight: 92, confidence: 90, status: '生效' },
  { tagId: 'TAG-FAMILY', label: '家庭用户', weight: 86, confidence: 84, status: '生效' },
  { tagId: 'TAG-LOCKED', label: '锁定表达', weight: 95, confidence: 95, status: '锁定' },
];

const tasks = [
  {
    taskId: 'TASK-L60', advisorId: 'ADV-001', targetModel: '乐道 L60',
    userQuestion: '成都家庭没有家充，通勤补能怎么安排？', topic: '成都家庭晚高峰补能实测',
    profileEvidence: ['TAG-LOCAL', 'TAG-FAMILY'], matrixGap: '晚高峰真实补能路线', status: '候选', routeScore: 10,
  },
  {
    taskId: 'TASK-L90', advisorId: 'ADV-001', targetModel: '乐道 L90',
    userQuestion: '第三排空间怎么样？', topic: '第三排空间参数讲解',
    profileEvidence: [], matrixGap: '', status: '候选', routeScore: 99,
  },
  {
    taskId: 'TASK-REJECTED', advisorId: 'ADV-001', targetModel: '乐道 L60',
    userQuestion: '已经拒绝的问题', topic: '已拒绝内容', profileEvidence: ['TAG-LOCAL'], status: '已拒绝',
  },
];

test('机会路由使用当前画像、线索和历史内容重新评分而不是沿用展示分', () => {
  const result = routeOpportunities({
    advisorId: 'ADV-001', tasks, profileTags,
    leads: [{ leadId: 'LEAD-1', advisorId: 'ADV-001', model: 'L60', originalComment: '成都没有家充，每天通勤怎么补能？', grade: 'A' }],
    contentResults: [{ contentId: 'CONTENT-1', taskId: 'TASK-OLD', title: '第三排空间参数讲解' }],
    limit: 3,
  });

  assert.deepEqual(result.recommendations.map((item) => item.taskId), ['TASK-L60', 'TASK-L90']);
  assert.ok(result.recommendations[0].score > result.recommendations[1].score);
  assert.deepEqual(result.recommendations[0].matchedProfileTags, ['成都本地', '家庭用户']);
  assert.equal(result.recommendations[0].scoreBreakdown.demand > 0, true);
  assert.equal(result.recommendations[1].scoreBreakdown.matrix < result.recommendations[0].scoreBreakdown.matrix, true);
  assert.match(result.recommendations[0].why, /画像|需求|矩阵/);
  assert.deepEqual(result.summary, { profileSignals: 3, taskPool: 2, demandSignals: 1, matrixCorpus: 1 });
});

test('接受机会进入待生成，拒绝机会必须记录原因和学习事件', () => {
  const accepted = decideOpportunity(tasks[0], { decision: 'accept', now: '2026-08-09T12:00:00.000Z' });
  const rejected = decideOpportunity(tasks[1], {
    decision: 'reject', reason: '近期没有第三排实拍素材', affectedTagId: 'TAG-FAMILY',
    eventId: 'EVENT-REJECT-1', now: '2026-08-09T12:00:00.000Z',
  });

  assert.equal(accepted.task.status, '待生成');
  assert.equal(accepted.task.decision, 'accept');
  assert.equal(accepted.feedbackEvent, null);
  assert.equal(rejected.task.status, '已拒绝');
  assert.equal(rejected.task.rejectionReason, '近期没有第三排实拍素材');
  assert.equal(rejected.feedbackEvent.eventType, '选题拒绝');
  assert.equal(rejected.feedbackEvent.weightDelta, -2);
  assert.throws(() => decideOpportunity(tasks[1], { decision: 'reject', reason: '' }), /拒绝原因/);
});
