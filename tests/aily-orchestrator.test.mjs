import assert from 'node:assert/strict';
import test from 'node:test';

import { AilyOrchestrator } from '../src/aily-orchestrator.mjs';
import { SimulationOneKosRepository } from '../src/onekos-repository.mjs';
import { OneKosService } from '../src/onekos-service.mjs';

function answerFor(question) {
  return question.type === 'text'
    ? '如果没有家充，我会先了解每天里程和附近补能条件，再给出合适建议。'
    : question.options[0].value;
}

test('Aily 对话可以逐题创建画像、接受任务并异步生成内容包', async () => {
  const repository = new SimulationOneKosRepository();
  const service = new OneKosService({ repository, mode: 'simulation' });
  const aily = new AilyOrchestrator({ service, repository, mode: 'simulation' });
  const conversationKey = 'aily-session-001:ou-user-001';

  let turn = await aily.startOnboarding({
    conversationKey,
    ailySessionId: 'aily-session-001',
    senderOpenId: 'ou-user-001',
    advisorId: 'ADV-AILY-TEST-001',
    displayName: '测试顾问',
    city: '上海',
    store: '上海测试门店',
  });
  assert.equal(turn.nextAction, 'ask_question');

  while (turn.nextAction === 'ask_question') {
    const question = turn.data.question;
    turn = await aily.answerOnboarding({ conversationKey, questionId: question.id, value: answerFor(question) });
  }
  assert.equal(turn.nextAction, 'confirm_profile');
  assert.ok(turn.data.candidates.length >= 30);

  turn = await aily.confirmOnboarding({ conversationKey });
  assert.equal(turn.nextAction, 'list_tasks');
  assert.equal(turn.state.advisorId, 'ADV-AILY-TEST-001');
  const firstTaskId = turn.data.firstTask.taskId;

  turn = await aily.decideTask({ conversationKey, taskId: firstTaskId, decision: 'accept' });
  assert.equal(turn.nextAction, 'generate_content');

  turn = await aily.startContentGeneration({ conversationKey });
  assert.equal(turn.nextAction, 'wait_content_generation');
  assert.equal(turn.state.asyncStatus, 'content_running');

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    turn = await aily.getContentStatus({ conversationKey });
    if (turn.nextAction !== 'wait_content_generation') break;
  }
  assert.equal(turn.nextAction, 'upload_material');
  assert.ok(turn.state.contentId.startsWith('CONTENT-'));
  assert.ok(turn.data.materials.length > 0);
  assert.ok(turn.data.materials.every((item) => 'scriptText' in item && 'visualDescription' in item));

  const restored = await aily.load(conversationKey);
  assert.equal(restored.contentId, turn.state.contentId);
  assert.equal(restored.senderOpenId, 'ou-user-001');
});

test('Aily 群聊会话键必须显式传入并可绑定已有顾问', async () => {
  const repository = new SimulationOneKosRepository();
  const service = new OneKosService({ repository, mode: 'simulation' });
  const aily = new AilyOrchestrator({ service, repository, mode: 'simulation' });
  await assert.rejects(() => aily.selectAdvisor({ advisorId: 'ADV-017' }), /conversationKey/);
  const selected = await aily.selectAdvisor({ conversationKey: 'chat-1:ou-1', advisorId: 'ADV-017' });
  assert.equal(selected.state.advisorId, 'ADV-017');
  assert.equal(selected.nextAction, 'list_tasks');
});
