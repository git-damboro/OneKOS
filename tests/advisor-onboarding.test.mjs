import assert from 'node:assert/strict';
import test from 'node:test';

import {
  confirmCandidateTags,
  createOnboardingSession,
  generateRuleCandidates,
  normalizeModelCandidates,
  normalizeOnboardingInput,
} from '../src/advisor-onboarding.mjs';

const rawInput = {
  advisorId: 'adv-new-001',
  displayName: '顾问小林',
  city: '成都',
  store: '成都模拟门店',
  experienceYears: 3,
  targetAudience: '城市通勤家庭',
  specialties: ['补能路线'],
  preferences: {
    openingStyle: '先结论后解释',
    evidencePreference: '实车场景证明',
    tone: '专业克制',
  },
};

test('基础资料与三组偏好形成可恢复的初始化会话', () => {
  const input = normalizeOnboardingInput(rawInput);
  const session = createOnboardingSession(input, {
    sessionId: 'ONB-001',
    now: '2026-08-09T00:00:00.000Z',
  });

  assert.equal(input.advisorId, 'ADV-NEW-001');
  assert.equal(input.specialties.length, 1);
  assert.equal(session.status, 'draft');
  assert.equal(session.advisorId, 'ADV-NEW-001');
  assert.deepEqual(session.writeProgress, {});
});

test('缺少必要资料或三组偏好时拒绝初始化', () => {
  assert.throws(() => normalizeOnboardingInput({ ...rawInput, city: '' }), /城市不能为空/);
  assert.throws(() => normalizeOnboardingInput({ ...rawInput, specialties: [] }), /至少填写一个擅长问题/);
  assert.throws(
    () => normalizeOnboardingInput({ ...rawInput, preferences: { ...rawInput.preferences, tone: '' } }),
    /表达语气不能为空/,
  );
});

test('无历史样本时规则候选降低置信度并保留输入证据', () => {
  const input = normalizeOnboardingInput(rawInput);
  const candidates = generateRuleCandidates(input);

  assert.ok(candidates.length >= 6);
  assert.ok(candidates.every((tag) => tag.confidence < 85));
  assert.ok(candidates.every((tag) => tag.evidence && tag.status === '候选'));
  assert.ok(candidates.some((tag) => tag.dimension === '地域场景' && /成都/.test(tag.label)));
});

test('授权样本提高规则候选置信度并保留样本来源', () => {
  const input = normalizeOnboardingInput({
    ...rawInput,
    historyContents: ['我更愿意先带用户跑一遍晚高峰补能路线。'],
    voiceTranscript: '我通常先给结论，再解释适合和不适合的条件。',
  });
  const candidates = generateRuleCandidates(input);

  assert.ok(candidates.some((tag) => tag.confidence >= 85));
  assert.ok(candidates.some((tag) => /历史内容|语音转写/.test(tag.source)));
});

test('模型候选只接受白名单维度、有效证据并去除重复标签', () => {
  const input = normalizeOnboardingInput(rawInput);
  const candidates = normalizeModelCandidates({ tags: [
    { dimension: '表达结构', label: '先结论后解释', weight: 120, confidence: 92, evidence: '偏好选择为先结论后解释' },
    { dimension: '表达结构', label: '先结论后解释', weight: 70, confidence: 70, evidence: '重复项' },
    { dimension: '敏感属性', label: '高消费能力', weight: 80, confidence: 80, evidence: '不允许推断' },
    { dimension: '专业能力', label: '补能路线拆解', weight: 76, confidence: 84, evidence: '' },
  ] }, input);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].dimension, '表达结构');
  assert.equal(candidates[0].weight, 100);
  assert.equal(candidates[0].source, '模型分析授权资料');
});

test('确认时只让已选择标签进入画像 V1 与首条任务', () => {
  const input = normalizeOnboardingInput(rawInput);
  const session = {
    ...createOnboardingSession(input, { sessionId: 'ONB-001', now: '2026-08-09T00:00:00.000Z' }),
    status: 'generated',
    candidates: generateRuleCandidates(input),
  };
  const selected = session.candidates.slice(0, 2).map((tag, index) => ({
    tagId: tag.tagId,
    label: index === 0 ? '家庭补能路线拆解' : tag.label,
    weight: index === 0 ? 88 : tag.weight,
    locked: index === 1,
  }));
  const result = confirmCandidateTags(session, selected, '2026-08-09T01:00:00.000Z');

  assert.equal(result.tags.length, 2);
  assert.equal(result.tags[0].label, '家庭补能路线拆解');
  assert.equal(result.tags[1].status, '锁定');
  assert.equal(result.profileVersion, 1);
  assert.deepEqual(result.task.profileEvidence, result.tags.map((tag) => tag.tagId));
  assert.equal(result.task.taskId, 'TASK-ADV-NEW-001-001');
});

