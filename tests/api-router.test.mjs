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
    async getContentPackage(contentId) { calls.push(['get-content', contentId]); return { content: { contentId }, recovered: true }; },
    async runProductionDemo(body) { calls.push(['production', body]); return { comparison: { complete: true } }; },
    async analyzeComment(body) { calls.push(['comment', body]); return { lead: { grade: 'A' } }; },
    async confirmFeedback(eventId) { calls.push(['feedback', eventId]); return { applied: true }; },
  };
  await withServer(service, async (baseUrl) => {
    const generated = await jsonPost(`${baseUrl}/api/content/generate`, { contentId: 'CONTENT-1' }).then((response) => response.json());
    const recovered = await fetch(`${baseUrl}/api/content/CONTENT-1`).then((response) => response.json());
    const production = await jsonPost(`${baseUrl}/api/production/demo`, { contentId: 'CONTENT-2' }).then((response) => response.json());
    const analyzed = await jsonPost(`${baseUrl}/api/comments/analyze`, { commentId: 'COMMENT-1', text: '想试驾' }).then((response) => response.json());
    const confirmed = await jsonPost(`${baseUrl}/api/feedback/EVENT-1/confirm`, {}).then((response) => response.json());
    assert.equal(generated.data.content.contentId, 'CONTENT-1');
    assert.equal(recovered.data.recovered, true);
    assert.equal(production.data.comparison.complete, true);
    assert.equal(analyzed.data.lead.grade, 'A');
    assert.equal(confirmed.data.applied, true);
    assert.deepEqual(calls.map((item) => item[0]), ['content', 'get-content', 'production', 'comment', 'feedback']);
  });
});

test('素材上传路由解析 multipart 并传递素材槽位与媒体元数据', async () => {
  const calls = [];
  let finishCheck;
  const checkCompleted = new Promise((resolve) => { finishCheck = resolve; });
  const service = {
    async getContentMaterials(contentId) { return { contentId, comparison: { complete: false } }; },
    async stageAdvisorAssetUpload(input) { calls.push(['stage', input]); return { uploadedAsset: { status: 'checking' } }; },
    async checkAdvisorAsset(input) { calls.push(['check', input]); finishCheck(); return { checkedAsset: { status: 'available' } }; },
  };
  await withServer(service, async (baseUrl) => {
    const materials = await fetch(`${baseUrl}/api/content/CONTENT-1/materials`).then((response) => response.json());
    assert.equal(materials.data.contentId, 'CONTENT-1');

    const form = new FormData();
    form.set('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'video/mp4' }), 'opening.mp4');
    form.set('advisorId', 'ADV-017');
    form.set('durationSec', '9.5');
    form.set('width', '1080');
    form.set('height', '1920');
    const response = await fetch(`${baseUrl}/api/content/CONTENT-1/assets/CONTENT-1-SLOT-001`, { method: 'POST', body: form });
    assert.equal(response.status, 202);
    assert.equal((await response.json()).data.uploadedAsset.status, 'checking');
    await checkCompleted;
  });

  assert.deepEqual(calls.map(([phase]) => phase), ['stage', 'check']);
  assert.equal(calls[0][1].contentId, 'CONTENT-1');
  assert.equal(calls[0][1].slotId, 'CONTENT-1-SLOT-001');
  assert.equal(calls[0][1].advisorId, 'ADV-017');
  assert.equal(calls[0][1].fileName, 'opening.mp4');
  assert.equal(calls[0][1].durationSec, 9.5);
  assert.equal(calls[0][1].bytes.byteLength, 3);
});

test('剪辑任务支持异步启动、状态查询和 MP4 预览', async () => {
  const calls = [];
  const service = {
    async startEditingJob(editingJobId) { calls.push(['start', editingJobId]); return { editingJobId, status: '待剪辑' }; },
    async getEditingJob(editingJobId) { calls.push(['get', editingJobId]); return { editingJobId, status: '待顾问预览', progress: 100 }; },
    async getEditingPreview(editingJobId) { calls.push(['preview', editingJobId]); return new Uint8Array([0, 1, 2, 3, 4, 5]); },
  };
  await withServer(service, async (baseUrl) => {
    const started = await jsonPost(`${baseUrl}/api/editing/jobs/RENDER-1/start`, {}).then((response) => response.json());
    const status = await fetch(`${baseUrl}/api/editing/jobs/RENDER-1`).then((response) => response.json());
    const preview = await fetch(`${baseUrl}/api/editing/jobs/RENDER-1/preview`);
    const partial = await fetch(`${baseUrl}/api/editing/jobs/RENDER-1/preview`, { headers: { Range: 'bytes=2-4' } });
    assert.equal(started.data.status, '待剪辑');
    assert.equal(status.data.progress, 100);
    assert.equal(preview.headers.get('content-type'), 'video/mp4');
    assert.equal(preview.headers.get('accept-ranges'), 'bytes');
    assert.deepEqual([...new Uint8Array(await preview.arrayBuffer())], [0, 1, 2, 3, 4, 5]);
    assert.equal(partial.status, 206);
    assert.equal(partial.headers.get('content-range'), 'bytes 2-4/6');
    assert.deepEqual([...new Uint8Array(await partial.arrayBuffer())], [2, 3, 4]);
  });
  assert.deepEqual(calls, [['start', 'RENDER-1'], ['get', 'RENDER-1'], ['preview', 'RENDER-1'], ['preview', 'RENDER-1']]);
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

test('顾问工作台 API 恢复已接受任务和已有内容包', async () => {
  const calls = [];
  const service = {
    async getAdvisorWorkspace(advisorId) {
      calls.push(advisorId);
      return { task: { taskId: 'TASK-001', decision: 'accept' }, contentPackage: null, stage: 'accepted_waiting_generation' };
    },
  };
  await withServer(service, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/advisors/${encodeURIComponent('ADV/017')}/workspace`);
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.data.task.taskId, 'TASK-001');
    assert.equal(payload.data.stage, 'accepted_waiting_generation');
  });
  assert.deepEqual(calls, ['ADV/017']);
});

test('顾问画像 API 返回已有画像而不创建新问卷', async () => {
  const calls = [];
  const service = {
    async getAdvisorProfile(advisorId) {
      calls.push(advisorId);
      return { advisor: { advisorId, initializationStatus: 'active' }, profileTags: [{ tagId: 'TAG-001' }] };
    },
  };
  await withServer(service, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/advisors/${encodeURIComponent('ADV/017')}/profile`);
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.data.advisor.initializationStatus, 'active');
    assert.equal(payload.data.profileTags[0].tagId, 'TAG-001');
  });
  assert.deepEqual(calls, ['ADV/017']);
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

test('问卷初始化 API 支持创建、恢复、逐题提交、完成和确认', async () => {
  const calls = [];
  const service = {
    async createQuizSession(body) { calls.push(['create', body]); return { session: { sessionId: 'QUIZ/001' } }; },
    async getQuizSession(id) { calls.push(['get', id]); return { session: { sessionId: id, status: 'quiz_active' } }; },
    async abandonQuizSession(id) { calls.push(['abandon', id]); return { session: { sessionId: id, status: 'abandoned' } }; },
    async submitQuizAnswer(id, body) { calls.push(['answer', id, body]); return { session: { sessionId: id, currentQuestionId: 'Q-2' } }; },
    async completeQuizSession(id) { calls.push(['complete', id]); return { session: { sessionId: id, status: 'generated', candidates: [] } }; },
    async confirmOnboardingSession(id, body) { calls.push(['confirm', id, body]); return { task: { taskId: 'TASK-QUIZ-001' } }; },
  };

  await withServer(service, async (baseUrl) => {
    const created = await jsonPost(`${baseUrl}/api/onboarding/quiz-sessions`, { advisorId: 'ADV-QUIZ-001' }).then((response) => response.json());
    assert.equal(created.data.session.sessionId, 'QUIZ/001');
    const path = `${baseUrl}/api/onboarding/quiz-sessions/${encodeURIComponent('QUIZ/001')}`;
    assert.equal((await fetch(path).then((response) => response.json())).data.session.status, 'quiz_active');
    assert.equal((await jsonPost(`${path}/answers`, { questionId: 'Q-1', value: 'A' }).then((response) => response.json())).data.session.currentQuestionId, 'Q-2');
    assert.equal((await jsonPost(`${path}/complete`, {}).then((response) => response.json())).data.session.status, 'generated');
    assert.equal((await jsonPost(`${path}/abandon`, {}).then((response) => response.json())).data.session.status, 'abandoned');
    const confirmed = await fetch(`${path}/confirm`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'QUIZ-CONFIRM-001' },
      body: JSON.stringify({ acceptedTags: [{ tagId: 'TERM-001' }] }),
    }).then((response) => response.json());
    assert.equal(confirmed.data.task.taskId, 'TASK-QUIZ-001');
  });

  assert.deepEqual(calls.map((item) => item[0]), ['create', 'get', 'answer', 'complete', 'abandon', 'confirm']);
  assert.equal(calls.at(-1)[2].idempotencyKey, 'QUIZ-CONFIRM-001');
});

test('机会雷达 API 支持读取、重新路由和接受拒绝决策', async () => {
  const calls = [];
  const service = {
    async getOpportunities(input) { calls.push(['get', input]); return { recommendations: [{ taskId: 'TASK-001' }] }; },
    async routeOpportunities(input) { calls.push(['route', input]); return { recommendations: [{ taskId: 'TASK-002' }] }; },
    async decideOpportunity(taskId, input) { calls.push(['decision', taskId, input]); return { task: { taskId, status: '已拒绝' } }; },
  };

  await withServer(service, async (baseUrl) => {
    const listed = await fetch(`${baseUrl}/api/opportunities?advisorId=ADV-017&limit=2`).then((response) => response.json());
    assert.equal(listed.data.recommendations[0].taskId, 'TASK-001');
    const routed = await jsonPost(`${baseUrl}/api/opportunities/route`, { advisorId: 'ADV-017', limit: 3 }).then((response) => response.json());
    assert.equal(routed.data.recommendations[0].taskId, 'TASK-002');
    const decided = await jsonPost(`${baseUrl}/api/opportunities/${encodeURIComponent('TASK/002')}/decision`, {
      advisorId: 'ADV-017', decision: 'reject', reason: '缺少素材',
    }).then((response) => response.json());
    assert.equal(decided.data.task.status, '已拒绝');
  });

  assert.deepEqual(calls, [
    ['get', { advisorId: 'ADV-017', limit: 2 }],
    ['route', { advisorId: 'ADV-017', limit: 3 }],
    ['decision', 'TASK/002', { advisorId: 'ADV-017', decision: 'reject', reason: '缺少素材' }],
  ]);
});
