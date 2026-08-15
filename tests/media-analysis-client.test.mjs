import assert from 'node:assert/strict';
import test from 'node:test';

import { DashScopeAsrClient, MediaAnalysisClient, QwenVisionClient } from '../src/media-analysis-client.mjs';

test('Fun-ASR 解析真实口播及毫秒时间戳', async () => {
  const client = new DashScopeAsrClient({
    baseUrl: 'https://example.test', apiKey: 'secret', model: 'fun-asr-flash-2026-06-15',
    fetchImpl: async () => new Response(JSON.stringify({ output: { text: '测试口播', sentences: [{ text: '测试口播', begin_time: 500, end_time: 2500 }] } }), { status: 200 }),
  });
  const result = await client.transcribe({ audioBytes: new Uint8Array([1, 2, 3]), durationSec: 3 });
  assert.equal(result.transcript, '测试口播');
  assert.deepEqual(result.sentences, [{ startSec: 0.5, endSec: 2.5, text: '测试口播' }]);
});

test('Qwen3-VL 按抽帧时间点请求结构化画面区间', async () => {
  let requestBody;
  const client = new QwenVisionClient({
    baseUrl: 'https://example.test/v1', apiKey: 'secret', model: 'qwen3-vl-flash',
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"summary":"拿起水杯","recommendedClip":{"startSec":1,"endSec":4}}' } }] }), { status: 200 });
    },
  });
  const result = await client.analyze({ frames: [{ timestampSec: 2, mimeType: 'image/jpeg', bytes: new Uint8Array([1]) }], requirement: {}, durationSec: 5 });
  assert.equal(result.summary, '拿起水杯');
  assert.equal(requestBody.messages[1].content[2].image_url.url.startsWith('data:image/jpeg;base64,'), true);
});

test('媒体解析将 ASR 与视觉结果合并并约束剪辑区间', async () => {
  const client = new MediaAnalysisClient({
    asrClient: { model: 'asr', async transcribe() { return { transcript: '真实口播', sentences: [{ startSec: 1, endSec: 3, text: '真实口播' }] }; } },
    visionClient: { model: 'vl', async analyze() { return { summary: '动作', recommendedClip: { startSec: -2, endSec: 99 } }; } },
  });
  const result = await client.analyze({ prepared: { durationSec: 5, audioBytes: new Uint8Array([1]), frames: [{}] }, requirement: {} });
  assert.deepEqual(result.recommendedClip, { startSec: 0, endSec: 5 });
  assert.equal(result.asr.transcript, '真实口播');
});
