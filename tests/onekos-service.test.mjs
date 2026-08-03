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
    }),
  };
}

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
  assert.equal(repository.snapshot().contentResults.filter((item) => item.contentId === 'CONTENT-TEST-001').length, 1);
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
