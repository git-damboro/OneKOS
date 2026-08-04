import { randomUUID } from 'node:crypto';

import { FeishuBitableClient } from './feishu-client.mjs';
import { OpenAICompatibleClient } from './llm-client.mjs';
import { FeishuOneKosRepository, SimulationOneKosRepository } from './onekos-repository.mjs';
import { OneKosService } from './onekos-service.mjs';
import { createRuntimeConfig, toPublicRuntimeStatus } from './runtime-config.mjs';

const MAX_JSON_BYTES = 1024 * 1024;

export function createOneKosRuntime({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const config = createRuntimeConfig(env);
  const repository = config.feishu.configured
    ? new FeishuOneKosRepository({
        client: new FeishuBitableClient({ ...config.feishu, fetchImpl, timeoutMs: config.requestTimeoutMs }),
        tableIds: config.feishu.tableIds,
      })
    : new SimulationOneKosRepository();
  const llmClient = config.llm.configured
    ? new OpenAICompatibleClient({ ...config.llm, fetchImpl })
    : null;
  return {
    config,
    runtimeStatus: toPublicRuntimeStatus(config),
    service: new OneKosService({ repository, llmClient, mode: config.mode }),
  };
}

function sendJson(response, status, payload, requestId) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Request-Id': requestId,
  });
  response.end(body);
}

async function readJsonBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_JSON_BYTES) {
      const error = new Error('请求体超过 1MB 限制');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('请求体不是合法 JSON');
    error.statusCode = 400;
    throw error;
  }
}

export function createApiHandler({ service, runtimeStatus }) {
  return async function handleApiRequest(request, response) {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    if (!url.pathname.startsWith('/api/')) return false;
    const requestId = randomUUID();

    try {
      if (request.method === 'OPTIONS') {
        sendJson(response, 204, {}, requestId);
        return true;
      }
      if (request.method === 'GET' && url.pathname === '/api/health') {
        sendJson(response, 200, { ok: true, runtime: runtimeStatus, timestamp: new Date().toISOString() }, requestId);
        return true;
      }
      if (request.method === 'GET' && url.pathname === '/api/demo/state') {
        const data = await service.getDemoState({
          advisorId: url.searchParams.get('advisorId') || 'ADV-017',
          taskId: url.searchParams.get('taskId') || 'TASK-001',
        });
        sendJson(response, 200, { ok: true, data, runtime: runtimeStatus }, requestId);
        return true;
      }
      if (request.method === 'POST' && url.pathname === '/api/content/generate') {
        const data = await service.generateContent(await readJsonBody(request));
        sendJson(response, 200, { ok: true, data, runtime: runtimeStatus }, requestId);
        return true;
      }
      if (request.method === 'POST' && url.pathname === '/api/comments/analyze') {
        const data = await service.analyzeComment(await readJsonBody(request));
        sendJson(response, 200, { ok: true, data, runtime: runtimeStatus }, requestId);
        return true;
      }
      const feedbackMatch = request.method === 'POST' && url.pathname.match(/^\/api\/feedback\/([^/]+)\/confirm$/);
      if (feedbackMatch) {
        await readJsonBody(request);
        const data = await service.confirmFeedback(decodeURIComponent(feedbackMatch[1]));
        sendJson(response, 200, { ok: true, data, runtime: runtimeStatus }, requestId);
        return true;
      }

      sendJson(response, 404, { ok: false, error: { code: 'API_NOT_FOUND', message: 'API 路由不存在', requestId } }, requestId);
      return true;
    } catch (error) {
      const status = Number(error.statusCode) || 500;
      sendJson(response, status, {
        ok: false,
        error: {
          code: status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
          message: error.message || '服务异常',
          requestId,
        },
        runtime: runtimeStatus,
      }, requestId);
      return true;
    }
  };
}
