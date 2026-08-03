export class OneKosApiError extends Error {
  constructor(message, { status = 0, requestId = null, payload = null } = {}) {
    super(message);
    this.name = 'OneKosApiError';
    this.status = status;
    this.requestId = requestId;
    this.payload = payload;
  }
}

async function request(path, { method = 'GET', body, timeoutMs = 60_000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
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
  getDemoState: (advisorId = 'ADV-017', taskId = 'TASK-001') => request(`/api/demo/state?advisorId=${encodeURIComponent(advisorId)}&taskId=${encodeURIComponent(taskId)}`),
  generateContent: (input) => request('/api/content/generate', { method: 'POST', body: input }),
  analyzeComment: (input) => request('/api/comments/analyze', { method: 'POST', body: input }),
  confirmFeedback: (eventId) => request(`/api/feedback/${encodeURIComponent(eventId)}/confirm`, { method: 'POST', body: {} }),
};
