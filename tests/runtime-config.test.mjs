import assert from 'node:assert/strict';
import test from 'node:test';

import { createRuntimeConfig, toPublicRuntimeStatus } from '../src/runtime-config.mjs';

const feishuEnv = {
  FEISHU_APP_ID: 'cli_test',
  FEISHU_APP_SECRET: 'feishu-secret',
  FEISHU_BASE_APP_TOKEN: 'base-token',
};

const llmEnv = {
  LLM_BASE_URL: 'https://example.test/v1',
  LLM_API_KEY: 'llm-secret',
  LLM_MODEL: 'demo-model',
};

test('完整飞书与模型配置判定为 live', () => {
  const config = createRuntimeConfig({ ...feishuEnv, ...llmEnv });
  assert.equal(config.mode, 'live');
  assert.equal(config.feishu.configured, true);
  assert.equal(config.llm.configured, true);
});

test('仅配置飞书时判定为 hybrid', () => {
  const config = createRuntimeConfig(feishuEnv);
  assert.equal(config.mode, 'hybrid');
  assert.equal(config.feishu.configured, true);
  assert.equal(config.llm.configured, false);
});

test('未配置外部服务时判定为 simulation', () => {
  const config = createRuntimeConfig({});
  assert.equal(config.mode, 'simulation');
  assert.deepEqual(config.warnings, ['飞书未配置，使用仓库内模拟数据', '外部模型未配置，使用本地确定性生成器']);
});

test('公开状态不会泄露密钥', () => {
  const config = createRuntimeConfig({ ...feishuEnv, ...llmEnv });
  const status = toPublicRuntimeStatus(config);
  const serialized = JSON.stringify(status);
  assert.equal(serialized.includes('feishu-secret'), false);
  assert.equal(serialized.includes('llm-secret'), false);
  assert.equal(status.feishu.appTokenHint, 'base…oken');
});

test('视频剪辑路径可由环境变量迁移且公开状态不暴露本机路径', () => {
  const config = createRuntimeConfig({ FFMPEG_PATH: '/usr/bin/ffmpeg', FFPROBE_PATH: '/usr/bin/ffprobe', VIDEO_WIDTH: '1080', VIDEO_HEIGHT: '1920' });
  assert.equal(config.video.ffmpegPath, '/usr/bin/ffmpeg');
  assert.equal(config.video.ffprobePath, '/usr/bin/ffprobe');
  assert.equal(config.video.width, 1080);
  assert.equal(toPublicRuntimeStatus(config).video.output, '1080x1920');
  assert.equal(JSON.stringify(toPublicRuntimeStatus(config)).includes('/usr/bin'), false);
});

