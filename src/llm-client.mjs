import { setDefaultResultOrder } from 'node:dns';

setDefaultResultOrder('ipv4first');

export class LlmApiError extends Error {
  constructor(message, { status = null, details = null } = {}) {
    super(message);
    this.name = 'LlmApiError';
    this.status = status;
    this.details = details;
  }
}

export function parseJsonContent(content) {
  if (typeof content !== 'string' || !content.trim()) throw new LlmApiError('模型未返回文本内容');
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const json = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(json);
  } catch (error) {
    throw new LlmApiError('模型未返回合法的结构化 JSON', { details: { cause: error.message, content: trimmed.slice(0, 300) } });
  }
}

function completionsUrl(baseUrl) {
  const normalized = baseUrl.replace(/\/$/, '');
  return normalized.endsWith('/chat/completions') ? normalized : `${normalized}/chat/completions`;
}

export class OpenAICompatibleClient {
  constructor({ baseUrl, apiKey, model, fetchImpl = globalThis.fetch, timeoutMs = 45_000, enableThinking = null }) {
    if (!baseUrl || !apiKey || !model) throw new Error('模型 Base URL、API Key 和模型名称均不能为空');
    this.url = completionsUrl(baseUrl);
    this.apiKey = apiKey;
    this.model = model;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.enableThinking = enableThinking;
  }

  async generateJson({ system = '你是一个只返回 JSON 的业务助手。', user, userContent, temperature = 0.3 }) {
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: userContent || user });

    let response;
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        response = await this.fetchImpl(this.url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'content-type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            model: this.model,
            messages,
            temperature,
            ...(typeof this.enableThinking === 'boolean' ? { enable_thinking: this.enableThinking } : {}),
          }),
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        break;
      } catch (error) {
        lastError = error;
        if (error?.name === 'TimeoutError' || /timeout/i.test(error?.message || '')) break;
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }
    if (!response) {
      const timedOut = lastError?.name === 'TimeoutError' || /timeout/i.test(lastError?.message || '');
      throw new LlmApiError(timedOut
        ? `模型请求超时（${Math.round(this.timeoutMs / 1000)} 秒），请检查模型服务地址和部署状态后重试`
        : `模型请求失败：${lastError?.message || 'unknown error'}`, {
        details: { cause: lastError?.name, code: lastError?.cause?.code || '', detail: lastError?.cause?.message || '' },
      });
    }

    let body;
    try {
      body = await response.json();
    } catch {
      throw new LlmApiError(`模型返回非 JSON 响应（HTTP ${response.status}）`, { status: response.status });
    }
    if (!response.ok) {
      throw new LlmApiError(`模型 API 错误：${body.error?.message || response.statusText || 'unknown error'}`, {
        status: response.status,
        details: body,
      });
    }

    return parseJsonContent(body.choices?.[0]?.message?.content);
  }
}
