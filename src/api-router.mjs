import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';

import { FeishuBitableClient } from './feishu-client.mjs';
import { FeishuOAuthClient, FeishuSessionStore } from './feishu-auth.mjs';
import { OpenAICompatibleClient } from './llm-client.mjs';
import { FeishuOneKosRepository, SimulationOneKosRepository } from './onekos-repository.mjs';
import { OneKosService } from './onekos-service.mjs';
import { createRuntimeConfig, toPublicRuntimeStatus } from './runtime-config.mjs';
import { LocalFfmpegVideoEditor } from './video-editor.mjs';

const MAX_JSON_BYTES = 1024 * 1024;
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

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
  const authClient = config.feishu.loginConfigured ? new FeishuOAuthClient({
    appId: config.feishu.appId, appSecret: config.feishu.appSecret, redirectUri: config.feishu.oauthRedirectUri,
    apiBaseUrl: config.feishu.apiBaseUrl, fetchImpl,
  }) : null;
  return {
    config,
    runtimeStatus: toPublicRuntimeStatus(config),
    service: new OneKosService({
      repository,
      llmClient,
      mode: config.mode,
      videoEditor: new LocalFfmpegVideoEditor(config.video),
    }),
    authClient,
    authSessions: new FeishuSessionStore(),
  };
}

function parseCookies(request) {
  return Object.fromEntries(String(request.headers.cookie || '').split(';').map((item) => item.trim().split('=').map(decodeURIComponent)).filter(([key]) => key));
}

function redirect(response, location, cookie = '') {
  response.writeHead(302, { Location: location, ...(cookie ? { 'Set-Cookie': cookie } : {}) });
  response.end();
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

async function readAssetUpload(request) {
  const contentType = String(request.headers['content-type'] || '');
  if (!contentType.startsWith('multipart/form-data')) {
    const error = new Error('素材上传必须使用 multipart/form-data');
    error.statusCode = 415;
    throw error;
  }
  const contentLength = Number(request.headers['content-length']) || 0;
  if (contentLength > MAX_UPLOAD_BYTES + 128 * 1024) {
    const error = new Error('单个素材不能超过 20MB');
    error.statusCode = 413;
    throw error;
  }
  const webRequest = new Request('http://127.0.0.1/api/upload', {
    method: 'POST',
    headers: { 'content-type': contentType, ...(contentLength ? { 'content-length': String(contentLength) } : {}) },
    body: Readable.toWeb(request),
    duplex: 'half',
  });
  const form = await webRequest.formData();
  const file = form.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') {
    const error = new Error('请选择要上传的文件');
    error.statusCode = 400;
    throw error;
  }
  if (!file.size || file.size > MAX_UPLOAD_BYTES) {
    const error = new Error(file.size ? '单个素材不能超过 20MB' : '不能上传空文件');
    error.statusCode = file.size ? 413 : 400;
    throw error;
  }
  return {
    advisorId: String(form.get('advisorId') || ''),
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    bytes: new Uint8Array(await file.arrayBuffer()),
    durationSec: Number(form.get('durationSec')) || 0,
    width: Number(form.get('width')) || 0,
    height: Number(form.get('height')) || 0,
  };
}

export function createApiHandler({ service, runtimeStatus, authClient = null, authSessions = null }) {
  return async function handleApiRequest(request, response) {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    if (request.method === 'GET' && url.pathname === '/auth/feishu/login') {
      if (!authClient || !authSessions) return false;
      const state = authSessions.createState(url.searchParams.get('returnTo') || '/');
      redirect(response, authClient.authorizeUrl(state));
      return true;
    }
    if (request.method === 'GET' && url.pathname === '/auth/feishu/callback') {
      if (!authClient || !authSessions) return false;
      const returnTo = authSessions.consumeState(url.searchParams.get('state') || '');
      if (!returnTo || !url.searchParams.get('code')) { response.writeHead(400); response.end('Feishu login expired'); return true; }
      try {
        const token = await authClient.exchangeCode(url.searchParams.get('code'));
        const user = await authClient.getUser(token.access_token);
        const identity = await service.resolveFeishuAdvisor(user);
        const sessionId = authSessions.createSession({ ...user, advisorId: identity.advisor.advisorId });
        redirect(response, returnTo, `onekos_session=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Secure`);
      } catch (error) { response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end(error.message); }
      return true;
    }
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
      if (request.method === 'GET' && url.pathname === '/api/auth/me') {
        const session = authSessions?.getSession(parseCookies(request).onekos_session || '');
        sendJson(response, 200, { ok: true, data: session ? { authenticated: true, user: session } : { authenticated: false }, runtime: runtimeStatus }, requestId);
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
      if (request.method === 'GET' && url.pathname === '/api/advisors') {
        const data = await service.listAdvisors();
        sendJson(response, 200, { ok: true, data, runtime: runtimeStatus }, requestId);
        return true;
      }
      if (request.method === 'POST' && url.pathname === '/api/advisors') {
        const data = await service.createAdvisorIdentity(await readJsonBody(request));
        sendJson(response, 200, { ok: true, data, runtime: runtimeStatus }, requestId);
        return true;
      }
      const advisorWorkspaceMatch = request.method === 'GET' && url.pathname.match(/^\/api\/advisors\/([^/]+)\/workspace$/);
      if (advisorWorkspaceMatch) {
        const data = await service.getAdvisorWorkspace(decodeURIComponent(advisorWorkspaceMatch[1]));
        sendJson(response, 200, { ok: true, data, runtime: runtimeStatus }, requestId);
        return true;
      }
      if (request.method === 'POST' && url.pathname === '/api/onboarding/quiz-sessions') {
        const data = await service.createQuizSession(await readJsonBody(request));
        sendJson(response, 200, { ok: true, data, runtime: runtimeStatus }, requestId);
        return true;
      }
      const quizAnswerMatch = request.method === 'POST' && url.pathname.match(/^\/api\/onboarding\/quiz-sessions\/([^/]+)\/answers$/);
      if (quizAnswerMatch) {
        const data = await service.submitQuizAnswer(decodeURIComponent(quizAnswerMatch[1]), await readJsonBody(request));
        sendJson(response, 200, { ok: true, data, runtime: runtimeStatus }, requestId);
        return true;
      }
      const quizCompleteMatch = request.method === 'POST' && url.pathname.match(/^\/api\/onboarding\/quiz-sessions\/([^/]+)\/complete$/);
      if (quizCompleteMatch) {
        await readJsonBody(request);
        const data = await service.completeQuizSession(decodeURIComponent(quizCompleteMatch[1]));
        sendJson(response, 200, { ok: true, data, runtime: runtimeStatus }, requestId);
        return true;
      }
      const quizConfirmMatch = request.method === 'POST' && url.pathname.match(/^\/api\/onboarding\/quiz-sessions\/([^/]+)\/confirm$/);
      if (quizConfirmMatch) {
        const body = await readJsonBody(request);
        const data = await service.confirmOnboardingSession(decodeURIComponent(quizConfirmMatch[1]), {
          acceptedTags: body.acceptedTags || [], idempotencyKey: request.headers['idempotency-key'] || body.idempotencyKey || '',
        });
        sendJson(response, 200, { ok: true, data, runtime: runtimeStatus }, requestId);
        return true;
      }
      const quizSessionMatch = request.method === 'GET' && url.pathname.match(/^\/api\/onboarding\/quiz-sessions\/([^/]+)$/);
      if (quizSessionMatch) {
        const data = await service.getQuizSession(decodeURIComponent(quizSessionMatch[1]));
        sendJson(response, 200, { ok: true, data, runtime: runtimeStatus }, requestId);
        return true;
      }
      if (request.method === 'POST' && url.pathname === '/api/onboarding/sessions') {
        const data = await service.createOnboardingSession(await readJsonBody(request));
        sendJson(response, 200, { ok: true, data, runtime: runtimeStatus }, requestId);
        return true;
      }
      const onboardingGenerateMatch = request.method === 'POST' && url.pathname.match(/^\/api\/onboarding\/sessions\/([^/]+)\/generate$/);
      if (onboardingGenerateMatch) {
        await readJsonBody(request);
        const data = await service.generateOnboardingCandidates(decodeURIComponent(onboardingGenerateMatch[1]));
        sendJson(response, 200, { ok: true, data, runtime: runtimeStatus }, requestId);
        return true;
      }
      const onboardingConfirmMatch = request.method === 'POST' && url.pathname.match(/^\/api\/onboarding\/sessions\/([^/]+)\/confirm$/);
      if (onboardingConfirmMatch) {
        const body = await readJsonBody(request);
        const data = await service.confirmOnboardingSession(decodeURIComponent(onboardingConfirmMatch[1]), {
          acceptedTags: body.acceptedTags || [],
          idempotencyKey: request.headers['idempotency-key'] || body.idempotencyKey || '',
        });
        sendJson(response, 200, { ok: true, data, runtime: runtimeStatus }, requestId);
        return true;
      }
      const onboardingSessionMatch = request.method === 'GET' && url.pathname.match(/^\/api\/onboarding\/sessions\/([^/]+)$/);
      if (onboardingSessionMatch) {
        const data = await service.getOnboardingSession(decodeURIComponent(onboardingSessionMatch[1]));
        sendJson(response, 200, { ok: true, data, runtime: runtimeStatus }, requestId);
        return true;
      }
      if (request.method === 'GET' && url.pathname === '/api/opportunities') {
        const data = await service.getOpportunities({
          advisorId: url.searchParams.get('advisorId') || 'ADV-017',
          limit: Number(url.searchParams.get('limit')) || 3,
        });
        sendJson(response, 200, { ok: true, data, runtime: runtimeStatus }, requestId);
        return true;
      }
      if (request.method === 'POST' && url.pathname === '/api/opportunities/route') {
        const body = await readJsonBody(request);
        const data = await service.routeOpportunities({ advisorId: body.advisorId || 'ADV-017', limit: Number(body.limit) || 3 });
        sendJson(response, 200, { ok: true, data, runtime: runtimeStatus }, requestId);
        return true;
      }
      const opportunityDecisionMatch = request.method === 'POST' && url.pathname.match(/^\/api\/opportunities\/([^/]+)\/decision$/);
      if (opportunityDecisionMatch) {
        const body = await readJsonBody(request);
        const data = await service.decideOpportunity(decodeURIComponent(opportunityDecisionMatch[1]), {
          advisorId: body.advisorId || 'ADV-017', decision: body.decision, reason: body.reason || '',
        });
        sendJson(response, 200, { ok: true, data, runtime: runtimeStatus }, requestId);
        return true;
      }
      if (request.method === 'POST' && url.pathname === '/api/content/generate') {
        const data = await service.generateContent(await readJsonBody(request));
        sendJson(response, 200, { ok: true, data, runtime: runtimeStatus }, requestId);
        return true;
      }
      const contentPackageMatch = request.method === 'GET' && url.pathname.match(/^\/api\/content\/([^/]+)$/);
      if (contentPackageMatch) {
        const data = await service.getContentPackage(decodeURIComponent(contentPackageMatch[1]));
        sendJson(response, 200, { ok: true, data, runtime: runtimeStatus }, requestId);
        return true;
      }
      const contentMaterialsMatch = request.method === 'GET' && url.pathname.match(/^\/api\/content\/([^/]+)\/materials$/);
      if (contentMaterialsMatch) {
        const data = await service.getContentMaterials(decodeURIComponent(contentMaterialsMatch[1]));
        sendJson(response, 200, { ok: true, data, runtime: runtimeStatus }, requestId);
        return true;
      }
      const assetUploadMatch = request.method === 'POST' && url.pathname.match(/^\/api\/content\/([^/]+)\/assets\/([^/]+)$/);
      if (assetUploadMatch) {
        const upload = {
          contentId: decodeURIComponent(assetUploadMatch[1]),
          slotId: decodeURIComponent(assetUploadMatch[2]),
          ...await readAssetUpload(request),
        };
        const data = service.stageAdvisorAssetUpload
          ? await service.stageAdvisorAssetUpload(upload)
          : await service.uploadAdvisorAsset(upload);
        sendJson(response, service.stageAdvisorAssetUpload ? 202 : 200, { ok: true, data, runtime: runtimeStatus }, requestId);
        if (service.stageAdvisorAssetUpload && service.checkAdvisorAsset) {
          setImmediate(() => {
            service.checkAdvisorAsset(upload).catch(async (error) => {
              console.error(`[material-check] ${upload.contentId}/${upload.slotId}:`, error);
              if (service.failAdvisorAssetCheck) {
                await service.failAdvisorAssetCheck({
                  contentId: upload.contentId,
                  slotId: upload.slotId,
                  message: error.message,
                }).catch((writeError) => console.error('[material-check] 写入失败状态时出错：', writeError));
              }
            });
          });
        }
        return true;
      }
      const editingJobStartMatch = request.method === 'POST' && url.pathname.match(/^\/api\/editing\/jobs\/([^/]+)\/start$/);
      if (editingJobStartMatch) {
        await readJsonBody(request);
        const data = await service.startEditingJob(decodeURIComponent(editingJobStartMatch[1]));
        sendJson(response, 202, { ok: true, data, runtime: runtimeStatus }, requestId);
        return true;
      }
      const editingPreviewMatch = request.method === 'GET' && url.pathname.match(/^\/api\/editing\/jobs\/([^/]+)\/preview$/);
      if (editingPreviewMatch) {
        const bytes = await service.getEditingPreview(decodeURIComponent(editingPreviewMatch[1]));
        const total = bytes.byteLength;
        const rangeHeader = request.headers.range;
        let statusCode = 200;
        let start = 0;
        let end = total - 1;
        if (rangeHeader) {
          const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
          if (!match || (!match[1] && !match[2])) {
            response.writeHead(416, { 'Content-Range': `bytes */${total}`, 'Accept-Ranges': 'bytes', 'X-Request-Id': requestId });
            response.end();
            return true;
          }
          if (!match[1]) {
            const suffixLength = Number(match[2]);
            start = Math.max(0, total - suffixLength);
          } else {
            start = Number(match[1]);
          }
          end = match[2] && match[1] ? Math.min(Number(match[2]), total - 1) : total - 1;
          if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= total || end < start) {
            response.writeHead(416, { 'Content-Range': `bytes */${total}`, 'Accept-Ranges': 'bytes', 'X-Request-Id': requestId });
            response.end();
            return true;
          }
          statusCode = 206;
        }
        const body = bytes.subarray(start, end + 1);
        response.writeHead(statusCode, {
          'Content-Type': 'video/mp4',
          'Content-Length': String(body.byteLength),
          'Accept-Ranges': 'bytes',
          ...(statusCode === 206 ? { 'Content-Range': `bytes ${start}-${end}/${total}` } : {}),
          'Cache-Control': 'no-store',
          'Content-Disposition': 'inline; filename="onekos-preview.mp4"',
          'X-Content-Type-Options': 'nosniff',
          'X-Request-Id': requestId,
        });
        response.end(Buffer.from(body));
        return true;
      }
      const editingJobMatch = request.method === 'GET' && url.pathname.match(/^\/api\/editing\/jobs\/([^/]+)$/);
      if (editingJobMatch) {
        const data = await service.getEditingJob(decodeURIComponent(editingJobMatch[1]));
        sendJson(response, 200, { ok: true, data, runtime: runtimeStatus }, requestId);
        return true;
      }
      if (request.method === 'POST' && url.pathname === '/api/production/demo') {
        const data = await service.runProductionDemo(await readJsonBody(request));
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
