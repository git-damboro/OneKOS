import assert from 'node:assert/strict';
import test from 'node:test';

import { createAppServer } from '../server.mjs';

async function withServer(service, run) {
  const server = createAppServer({
    service,
    runtimeStatus: { mode: 'simulation', simulation: true, warnings: ['测试模式'], feishu: { configured: false }, llm: { configured: false } },
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function jsonPost(url, body) {
  return fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

test('健康检查与演示状态返回显式运行模式', async () => {
  const service = { async getDemoState() { return { advisor: { advisorId: 'ADV-017' } }; } };
  await withServer(service, async (baseUrl) => {
    const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json());
    assert.equal(health.ok, true);
    assert.equal(health.runtime.mode, 'simulation');

    const state = await fetch(`${baseUrl}/api/demo/state`).then((response) => response.json());
    assert.equal(state.data.advisor.advisorId, 'ADV-017');
    assert.equal(state.runtime.simulation, true);
  });
});

test('内容生成、评论分析与反馈确认路由到业务服务', async () => {
  const calls = [];
  const service = {
    async generateContent(body) { calls.push(['content', body]); return { content: { contentId: body.contentId } }; },
    async analyzeComment(body) { calls.push(['comment', body]); return { lead: { grade: 'A' } }; },
    async confirmFeedback(eventId) { calls.push(['feedback', eventId]); return { applied: true }; },
  };
  await withServer(service, async (baseUrl) => {
    const generated = await jsonPost(`${baseUrl}/api/content/generate`, { contentId: 'CONTENT-1' }).then((response) => response.json());
    const analyzed = await jsonPost(`${baseUrl}/api/comments/analyze`, { commentId: 'COMMENT-1', text: '想试驾' }).then((response) => response.json());
    const confirmed = await jsonPost(`${baseUrl}/api/feedback/EVENT-1/confirm`, {}).then((response) => response.json());
    assert.equal(generated.data.content.contentId, 'CONTENT-1');
    assert.equal(analyzed.data.lead.grade, 'A');
    assert.equal(confirmed.data.applied, true);
    assert.deepEqual(calls.map((item) => item[0]), ['content', 'comment', 'feedback']);
  });
});

test('非法 JSON、未知 API 与业务错误返回统一结构', async () => {
  const service = { async generateContent() { const error = new Error('任务不存在'); error.statusCode = 404; throw error; } };
  await withServer(service, async (baseUrl) => {
    const badJsonResponse = await fetch(`${baseUrl}/api/content/generate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
    const badJson = await badJsonResponse.json();
    assert.equal(badJsonResponse.status, 400);
    assert.equal(badJson.ok, false);
    assert.ok(badJson.error.requestId);

    const businessResponse = await jsonPost(`${baseUrl}/api/content/generate`, {});
    assert.equal(businessResponse.status, 404);
    assert.match((await businessResponse.json()).error.message, /任务不存在/);

    const unknownResponse = await fetch(`${baseUrl}/api/unknown`);
    assert.equal(unknownResponse.status, 404);
    assert.equal((await unknownResponse.json()).error.code, 'API_NOT_FOUND');
  });
});

test('顾问与初始化 API 完整路由到服务并传递确认幂等键', async () => {
  const calls = [];
  const service = {
    async listAdvisors() { calls.push(['list']); return [{ advisorId: 'ADV-017' }]; },
    async createAdvisorIdentity(body) { calls.push(['advisor', body]); return { advisor: { advisorId: body.advisorId } }; },
    async createOnboardingSession(body) { calls.push(['session', body]); return { session: { sessionId: 'ONB/001' } }; },
    async getOnboardingSession(sessionId) { calls.push(['get', sessionId]); return { sessionId, status: 'draft' }; },
    async generateOnboardingCandidates(sessionId) { calls.push(['generate', sessionId]); return { session: { sessionId, status: 'generated' } }; },
    async confirmOnboardingSession(sessionId, body) { calls.push(['confirm', sessionId, body]); return { task: { taskId: 'TASK-NEW-001' } }; },
  };

  await withServer(service, async (baseUrl) => {
    const advisors = await fetch(`${baseUrl}/api/advisors`).then((response) => response.json());
    assert.equal(advisors.data[0].advisorId, 'ADV-017');

    const createdAdvisor = await jsonPost(`${baseUrl}/api/advisors`, { advisorId: 'ADV-NEW-001', displayName: '顾问小林' }).then((response) => response.json());
    assert.equal(createdAdvisor.data.advisor.advisorId, 'ADV-NEW-001');

    const createdSession = await jsonPost(`${baseUrl}/api/onboarding/sessions`, { advisorId: 'ADV-NEW-001' }).then((response) => response.json());
    assert.equal(createdSession.data.session.sessionId, 'ONB/001');

    const restored = await fetch(`${baseUrl}/api/onboarding/sessions/${encodeURIComponent('ONB/001')}`).then((response) => response.json());
    assert.equal(restored.data.sessionId, 'ONB/001');

    const generated = await jsonPost(`${baseUrl}/api/onboarding/sessions/${encodeURIComponent('ONB/001')}/generate`, {}).then((response) => response.json());
    assert.equal(generated.data.session.status, 'generated');

    const confirmResponse = await fetch(`${baseUrl}/api/onboarding/sessions/${encodeURIComponent('ONB/001')}/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'CONFIRM-001' },
      body: JSON.stringify({ acceptedTags: [{ tagId: 'TAG-001' }] }),
    });
    const confirmed = await confirmResponse.json();
    assert.equal(confirmed.data.task.taskId, 'TASK-NEW-001');
  });

  assert.deepEqual(calls.map((item) => item[0]), ['list', 'advisor', 'session', 'get', 'generate', 'confirm']);
  assert.deepEqual(calls.at(-1), ['confirm', 'ONB/001', {
    acceptedTags: [{ tagId: 'TAG-001' }],
    idempotencyKey: 'CONFIRM-001',
  }]);
});

test('不存在的初始化会话保持统一 404 错误结构', async () => {
  const service = {
    async getOnboardingSession() {
      const error = new Error('初始化会话不存在：ONB-MISSING');
      error.statusCode = 404;
      throw error;
    },
  };

  await withServer(service, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/onboarding/sessions/ONB-MISSING`);
    const payload = await response.json();
    assert.equal(response.status, 404);
    assert.equal(payload.ok, false);
    assert.match(payload.error.message, /初始化会话不存在/);
    assert.ok(payload.error.requestId);
  });
});
