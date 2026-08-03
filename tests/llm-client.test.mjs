import assert from 'node:assert/strict';
import test from 'node:test';

import { LlmApiError, OpenAICompatibleClient, parseJsonContent } from '../src/llm-client.mjs';

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('解析标准 JSON 与 Markdown JSON 代码块', () => {
  assert.deepEqual(parseJsonContent('{"title":"A"}'), { title: 'A' });
  assert.deepEqual(parseJsonContent('```json\n{"title":"B"}\n```'), { title: 'B' });
  assert.throws(() => parseJsonContent('这不是 JSON'), /结构化 JSON/);
});

test('调用 OpenAI-compatible chat completions 并返回结构化结果', async () => {
  const calls = [];
  const client = new OpenAICompatibleClient({
    baseUrl: 'https://llm.test/v1/',
    apiKey: 'secret',
    model: 'demo-model',
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return response({ choices: [{ message: { content: '```json\n{"hook":"你好"}\n```' } }] });
    },
  });

  const result = await client.generateJson({ system: 'system', user: 'user', temperature: 0.2 });
  assert.deepEqual(result, { hook: '你好' });
  assert.equal(calls[0].url, 'https://llm.test/v1/chat/completions');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer secret');
  assert.equal(JSON.parse(calls[0].options.body).model, 'demo-model');
});

test('模型 HTTP 错误与无效响应转换为可诊断错误', async () => {
  const httpClient = new OpenAICompatibleClient({
    baseUrl: 'https://llm.test/v1', apiKey: 'secret', model: 'm',
    fetchImpl: async () => response({ error: { message: 'quota exceeded' } }, 429),
  });
  await assert.rejects(() => httpClient.generateJson({ user: 'x' }), (error) => error instanceof LlmApiError && error.status === 429 && error.message.includes('quota exceeded'));

  const invalidClient = new OpenAICompatibleClient({
    baseUrl: 'https://llm.test/v1', apiKey: 'secret', model: 'm',
    fetchImpl: async () => response({ choices: [] }),
  });
  await assert.rejects(() => invalidClient.generateJson({ user: 'x' }), /未返回文本内容/);
});

test('网络或超时异常不会泄露 API Key', async () => {
  const client = new OpenAICompatibleClient({
    baseUrl: 'https://llm.test/v1', apiKey: 'super-secret', model: 'm',
    fetchImpl: async () => { throw new Error('network down'); },
  });
  await assert.rejects(
    () => client.generateJson({ user: 'x' }),
    (error) => error instanceof LlmApiError && !error.message.includes('super-secret') && error.message.includes('network down'),
  );
});
