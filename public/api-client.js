export class OneKosApiError extends Error {
  constructor(message, { status = 0, requestId = null, payload = null } = {}) {
    super(message);
    this.name = 'OneKosApiError';
    this.status = status;
    this.requestId = requestId;
    this.payload = payload;
  }
}

async function request(path, { method = 'GET', body, headers = {}, timeoutMs = 60_000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const isFormData = body instanceof FormData;
    const response = await fetch(path, {
      method,
      headers: body === undefined || isFormData ? headers : { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      throw new OneKosApiError(payload?.error?.message || `请求失败（HTTP ${response.status}）`, {
        status: response.status,
        requestId: payload?.error?.requestId || response.headers.get('x-request-id'),
        payload,
      });
    }
    return payload;
  } catch (error) {
    if (error instanceof OneKosApiError) throw error;
    if (error.name === 'AbortError') throw new OneKosApiError('请求超时，请检查飞书或模型连接');
    throw new OneKosApiError(`无法连接 OneKOS 服务：${error.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

export const oneKosApi = {
  health: () => request('/api/health', { timeoutMs: 10_000 }),
  listAdvisors: () => request('/api/advisors'),
  createAdvisor: (input) => request('/api/advisors', { method: 'POST', body: input }),
  createQuizSession: (input) => request('/api/onboarding/quiz-sessions', { method: 'POST', body: input }),
  getQuizSession: (sessionId) => request(`/api/onboarding/quiz-sessions/${encodeURIComponent(sessionId)}`),
  submitQuizAnswer: (sessionId, answer) => request(`/api/onboarding/quiz-sessions/${encodeURIComponent(sessionId)}/answers`, { method: 'POST', body: answer }),
  completeQuizSession: (sessionId) => request(`/api/onboarding/quiz-sessions/${encodeURIComponent(sessionId)}/complete`, { method: 'POST', body: {} }),
  confirmQuizSession: (sessionId, acceptedTags, idempotencyKey) => request(`/api/onboarding/quiz-sessions/${encodeURIComponent(sessionId)}/confirm`, {
    method: 'POST', body: { acceptedTags }, headers: idempotencyKey ? { 'idempotency-key': idempotencyKey } : {},
  }),
  createOnboardingSession: (input) => request('/api/onboarding/sessions', { method: 'POST', body: input }),
  getOnboardingSession: (sessionId) => request(`/api/onboarding/sessions/${encodeURIComponent(sessionId)}`),
  generateOnboardingCandidates: (sessionId) => request(`/api/onboarding/sessions/${encodeURIComponent(sessionId)}/generate`, { method: 'POST', body: {} }),
  confirmOnboardingSession: (sessionId, acceptedTags, idempotencyKey) => request(`/api/onboarding/sessions/${encodeURIComponent(sessionId)}/confirm`, {
    method: 'POST',
    body: { acceptedTags },
    headers: idempotencyKey ? { 'idempotency-key': idempotencyKey } : {},
  }),
  getDemoState: (advisorId = 'ADV-017', taskId = 'TASK-001') => request(`/api/demo/state?advisorId=${encodeURIComponent(advisorId)}&taskId=${encodeURIComponent(taskId)}`),
  getOpportunities: (advisorId = 'ADV-017', limit = 3) => request(`/api/opportunities?advisorId=${encodeURIComponent(advisorId)}&limit=${encodeURIComponent(limit)}`),
  routeOpportunities: (advisorId = 'ADV-017', limit = 3) => request('/api/opportunities/route', { method: 'POST', body: { advisorId, limit } }),
  decideOpportunity: (taskId, advisorId, decision, reason = '') => request(`/api/opportunities/${encodeURIComponent(taskId)}/decision`, {
    method: 'POST', body: { advisorId, decision, reason },
  }),
  generateContent: (input) => request('/api/content/generate', { method: 'POST', body: input, timeoutMs: 120_000 }),
  getContentPackage: (contentId) => request(`/api/content/${encodeURIComponent(contentId)}`),
  getContentMaterials: (contentId) => request(`/api/content/${encodeURIComponent(contentId)}/materials`),
  uploadAsset: (contentId, slotId, { file, advisorId, durationSec = 0, width = 0, height = 0 }) => {
    const form = new FormData();
    form.set('file', file);
    form.set('advisorId', advisorId);
    form.set('durationSec', String(durationSec));
    form.set('width', String(width));
    form.set('height', String(height));
    return request(`/api/content/${encodeURIComponent(contentId)}/assets/${encodeURIComponent(slotId)}`, {
      method: 'POST', body: form, timeoutMs: 120_000,
    });
  },
  startEditingJob: (editingJobId) => request(`/api/editing/jobs/${encodeURIComponent(editingJobId)}/start`, {
    method: 'POST', body: {}, timeoutMs: 20_000,
  }),
  getEditingJob: (editingJobId) => request(`/api/editing/jobs/${encodeURIComponent(editingJobId)}`, { timeoutMs: 20_000 }),
  analyzeComment: (input) => request('/api/comments/analyze', { method: 'POST', body: input }),
  confirmFeedback: (eventId) => request(`/api/feedback/${encodeURIComponent(eventId)}/confirm`, { method: 'POST', body: {} }),
};
