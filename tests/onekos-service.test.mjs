import assert from 'node:assert/strict';
import test from 'node:test';

import { SimulationOneKosRepository } from '../src/onekos-repository.mjs';
import { OneKosService } from '../src/onekos-service.mjs';

function createService(options = {}) {
  const repository = new SimulationOneKosRepository();
  return {
    repository,
    service: new OneKosService({
      repository,
      mode: options.mode || 'simulation',
      llmClient: options.llmClient || null,
      clock: () => new Date('2026-08-04T02:00:00.000Z'),
      idFactory: options.idFactory || (() => 'ONB-TEST-001'),
    }),
  };
}

const onboardingInput = {
  advisorId: 'ADV-NEW-001', displayName: '顾问小林', city: '成都', store: '成都模拟门店',
  experienceYears: 3, targetAudience: '城市通勤家庭', specialties: ['补能路线'], targetModel: '乐道 L60',
  preferences: { openingStyle: '先结论后解释', evidencePreference: '实车场景证明', tone: '专业克制' },
  historyContents: ['我会先跑一遍成都晚高峰补能路线。'],
  identitySource: 'demo',
};

test('创建初始化会话并保存处于采集状态的顾问', async () => {
  const { service, repository } = createService();
  const result = await service.createOnboardingSession(onboardingInput);

  assert.equal(result.session.sessionId, 'ONB-TEST-001');
  assert.equal(result.session.status, 'draft');
  assert.equal(result.advisor.initializationStatus, 'collecting');
  assert.equal((await service.getOnboardingSession('ONB-TEST-001')).advisorId, 'ADV-NEW-001');
  assert.equal(repository.snapshot().advisors.filter((item) => item.advisorId === 'ADV-NEW-001').length, 1);
});

test('未配置模型时使用规则候选并保存 generated 会话', async () => {
  const { service } = createService();
  await service.createOnboardingSession(onboardingInput);
  const result = await service.generateOnboardingCandidates('ONB-TEST-001');

  assert.equal(result.session.status, 'generated');
  assert.equal(result.session.generator, 'local-rule-fallback');
  assert.ok(result.session.candidates.length >= 6);
});

test('模型候选通过证据校验时使用 external-llm', async () => {
  const llmClient = {
    async generateJson() {
      return { tags: [{
        dimension: '表达结构', label: '先结论后解释', weight: 84, confidence: 91,
        evidence: '顾问偏好选择先结论后解释',
      }] };
    },
  };
  const { service } = createService({ llmClient });
  await service.createOnboardingSession(onboardingInput);
  const result = await service.generateOnboardingCandidates('ONB-TEST-001');

  assert.equal(result.session.generator, 'external-llm');
  assert.equal(result.session.candidates.length, 1);
});

test('模型异常或无证据候选自动降级且不泄露异常详情', async () => {
  const llmClient = { async generateJson() { throw new Error('request failed: secret-key-value'); } };
  const { service } = createService({ llmClient });
  await service.createOnboardingSession(onboardingInput);
  const result = await service.generateOnboardingCandidates('ONB-TEST-001');

  assert.equal(result.session.generator, 'local-rule-fallback');
  assert.match(result.session.warnings[0], /规则/);
  assert.doesNotMatch(result.session.warnings[0], /secret-key-value/);
});

test('确认候选后写入画像 V1 与首条任务，重复确认不创建重复记录', async () => {
  const { service, repository } = createService();
  await service.createOnboardingSession(onboardingInput);
  const generated = await service.generateOnboardingCandidates('ONB-TEST-001');
  const acceptedTags = generated.session.candidates.slice(0, 3).map((tag) => ({
    tagId: tag.tagId, label: tag.label, weight: tag.weight, locked: false,
  }));

  const first = await service.confirmOnboardingSession('ONB-TEST-001', { acceptedTags, idempotencyKey: 'CONFIRM-001' });
  const second = await service.confirmOnboardingSession('ONB-TEST-001', { acceptedTags, idempotencyKey: 'CONFIRM-001' });

  assert.equal(first.advisor.profileVersion, 1);
  assert.equal(first.advisor.initializationStatus, 'active');
  assert.equal(first.tags.length, 3);
  assert.equal(first.task.status, '待生成');
  assert.equal(second.task.taskId, first.task.taskId);
  const snapshot = repository.snapshot();
  assert.equal(snapshot.advisors.filter((item) => item.advisorId === 'ADV-NEW-001').length, 1);
  assert.equal(snapshot.profileTags.filter((item) => item.advisorId === 'ADV-NEW-001').length, 3);
  assert.equal(snapshot.contentTasks.filter((item) => item.taskId === first.task.taskId).length, 1);
  assert.equal(snapshot.onboardingSessions.find((item) => item.sessionId === 'ONB-TEST-001').status, 'confirmed');
});

test('候选生成前确认会话返回 409', async () => {
  const { service } = createService();
  await service.createOnboardingSession(onboardingInput);

  await assert.rejects(
    service.confirmOnboardingSession('ONB-TEST-001', { acceptedTags: [] }),
    (error) => error.statusCode === 409 && /尚未生成/.test(error.message),
  );
});

test('读取 ADV-017 画像、TASK-001 与有效品牌知识', async () => {
  const { service } = createService();
  const context = await service.getAdvisorContext({ advisorId: 'ADV-017', taskId: 'TASK-001' });

  assert.equal(context.advisor.displayName, '顾问 017');
  assert.equal(context.task.taskId, 'TASK-001');
  assert.equal(context.profileTags.length, 4);
  assert.deepEqual(context.knowledge.map((item) => item.knowledgeId), ['KB-L60-001']);
  assert.equal(context.simulation, true);
});

test('生成内容并按内容 ID 幂等写回', async () => {
  const { service, repository } = createService();
  const first = await service.generateContent({ advisorId: 'ADV-017', taskId: 'TASK-001', contentId: 'CONTENT-TEST-001' });
  const second = await service.generateContent({ advisorId: 'ADV-017', taskId: 'TASK-001', contentId: 'CONTENT-TEST-001' });

  assert.equal(first.write.action, 'created');
  assert.equal(second.write.action, 'updated');
  assert.match(first.content.title, /成都/);
  assert.equal(first.content.status, '待顾问补真实素材');
  assert.equal(first.content.simulation, true);
  assert.equal(first.quality.passed, true);
  assert.equal(first.content.schemaVersion, '2.0');
  assert.ok(first.content.shots.length > 0);
  assert.ok(first.shootingRequirements.every((item) => item.slotId.startsWith('CONTENT-TEST-001-SLOT-')));
  assert.equal(repository.snapshot().contentResults.filter((item) => item.contentId === 'CONTENT-TEST-001').length, 1);
  assert.equal(repository.snapshot().shootingRequirements.length, first.shootingRequirements.length);
});

test('配置模型时使用模型候选结果，但仍由服务端质检和落库', async () => {
  let calls = 0;
  const llmClient = {
    async generateJson() {
      calls += 1;
      return {
        title: '成都晚高峰补能实测计划', hook: '先记录五天，再给真实答案',
        script: '所有等待时间与电量变化由顾问拍摄后补充。',
        storyboard: ['顾问开场', '路线记录', '结果待补'], materials: ['顾问实拍'],
        replyPlan: ['由顾问人工回复'], cta: '留下你的通勤距离',
        factRefs: [], profileRefs: ['TAG-001', 'TAG-002', 'TAG-003'],
      };
    },
  };
  const { service } = createService({ mode: 'live', llmClient });
  const result = await service.generateContent({ advisorId: 'ADV-017', taskId: 'TASK-001', contentId: 'CONTENT-LLM-001' });

  assert.equal(calls, 1);
  assert.equal(result.generator, 'external-llm');
  assert.equal(result.quality.passed, true);
  assert.equal(result.content.schemaVersion, '2.0');
  assert.equal(result.content.shots.length, 3);
});

test('生产演示用代码比较 JSON2/JSON3，齐全后创建剪辑任务', async () => {
  const { service, repository } = createService();
  const result = await service.runProductionDemo({ advisorId: 'ADV-017', taskId: 'TASK-001', contentId: 'CONTENT-PIPELINE-001' });

  assert.equal(result.json2.schemaVersion, '2.0');
  assert.equal(result.json3.simulation, true);
  assert.equal(result.comparison.complete, true);
  assert.equal(result.comparison.requiredCount, result.comparison.matchedCount);
  assert.equal(result.editingJob.status, '待剪辑');
  assert.equal(result.editingJob.simulation, true);
  assert.ok(result.json3.uploadedAssets.every((asset) => asset.fileToken === null && asset.simulation === true));
  assert.equal(repository.snapshot().advisorAssets.length, result.comparison.requiredCount);
  assert.equal(repository.snapshot().editingJobs.length, 1);
  assert.ok(repository.snapshot().shootingRequirements.every((item) => item.status === '检查通过'));
});

test('顾问上传一个真实素材后立即检查并重新组装 JSON3', async () => {
  const { service, repository } = createService();
  const generation = await service.generateContent({ advisorId: 'ADV-017', taskId: 'TASK-001', contentId: 'CONTENT-UPLOAD-001' });
  const requirement = generation.shootingRequirements[0];
  const result = await service.uploadAdvisorAsset({
    contentId: 'CONTENT-UPLOAD-001', slotId: requirement.slotId, advisorId: 'ADV-017',
    fileName: 'opening.mp4', mimeType: 'video/mp4', bytes: new Uint8Array([1, 2, 3]),
    durationSec: Math.max(9, requirement.minDurationSec), width: 1080, height: 1920,
  });

  assert.equal(result.checkedAsset.status, 'available');
  assert.equal(result.comparison.matchedCount, 1);
  assert.equal(result.status, 'waiting_upload');
  assert.equal(result.json3.uploadedAssets.find((asset) => asset.slotId === requirement.slotId).fileName, 'opening.mp4');
  assert.equal(repository.snapshot().advisorAssets.find((asset) => asset.slotId === requirement.slotId).technicalCheckStatus, '检查通过');
});

test('评论转 A 级线索并创建待确认反馈事件', async () => {
  const { service } = createService();
  const result = await service.analyzeComment({
    advisorId: 'ADV-017', contentId: 'CONTENT-DEMO-001', commentId: 'COMMENT-DEMO-001',
    text: '我在成都高新区，家里两个孩子，最近一个月准备换车，想看乐道 L60，这周六能试驾吗？',
    likes: 36, platform: '抖音（模拟）', leadId: 'LEAD-TEST-001', eventId: 'EVENT-TEST-001',
  });

  assert.equal(result.lead.grade, 'A');
  assert.equal(result.lead.status, '待顾问人工接管');
  assert.equal(result.lead.automationAllowed, false);
  assert.equal(result.feedbackEvent.status, '待顾问确认后学习');
  assert.equal(result.leadWrite.action, 'created');
  assert.equal(result.eventWrite.action, 'created');
});

test('结合顾问地域与当前内容主题补全本地高意向评论', async () => {
  const { service } = createService();
  const result = await service.analyzeComment({
    advisorId: 'ADV-017', contentId: 'CONTENT-DEMO-001', commentId: 'COMMENT-LOCAL-001',
    text: '我在高新区，每天通勤 35 公里，没有家充，这周日可以约 L60 试驾顺便看看换电吗？',
    likes: 17, platform: '抖音（模拟）', leadId: 'LEAD-LOCAL-001', eventId: 'EVENT-LOCAL-001',
  });

  assert.equal(result.lead.city, '成都高新区');
  assert.equal(result.lead.grade, 'A');
  assert.ok(result.lead.score >= 75);
  assert.match(result.lead.fieldEvidence.city, /顾问服务城市/);
});

test('人工确认反馈后才更新画像权重', async () => {
  const { service, repository } = createService();
  await service.analyzeComment({
    advisorId: 'ADV-017', contentId: 'CONTENT-DEMO-001', commentId: 'COMMENT-DEMO-001',
    text: '我在成都高新区，家里两个孩子，最近一个月准备换车，想看乐道 L60，这周六能试驾吗？',
    likes: 36, leadId: 'LEAD-TEST-001', eventId: 'EVENT-TEST-001',
  });
  assert.equal(repository.snapshot().profileTags.find((item) => item.tagId === 'TAG-004').weight, 76);

  const result = await service.confirmFeedback('EVENT-TEST-001');
  assert.equal(result.applied, true);
  assert.equal(repository.snapshot().profileTags.find((item) => item.tagId === 'TAG-004').weight, 82);
  assert.equal(repository.snapshot().feedbackEvents.find((item) => item.eventId === 'EVENT-TEST-001').status, '已确认并学习');
});
