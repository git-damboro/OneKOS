export const DEFAULT_TABLE_IDS = Object.freeze({
  guide: 'tbl4ZhnnRrQUH5UE',
  advisors: 'tbl1Zo2ok0NNCx4X',
  profileTags: 'tbl4XQnP5hWkVvGn',
  brandKnowledge: 'tbl41FAWlj0gMQaL',
  contentTasks: 'tbl6M9VXJVVs90VU',
  contentResults: 'tbl7Lio87hTuAlCz',
  commentLeads: 'tbl3Zkta6p45B6Ln',
  feedbackEvents: 'tbl3jWEOKNqN33w1',
});

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function hint(value) {
  if (!value) return null;
  if (value.length <= 8) return '已配置';
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function createRuntimeConfig(env = process.env) {
  const feishuConfigured = Boolean(env.FEISHU_APP_ID && env.FEISHU_APP_SECRET && env.FEISHU_BASE_APP_TOKEN);
  const llmConfigured = Boolean(env.LLM_BASE_URL && env.LLM_API_KEY && env.LLM_MODEL);
  const warnings = [];

  if (!feishuConfigured) warnings.push('飞书未配置，使用仓库内模拟数据');
  if (!llmConfigured) warnings.push('外部模型未配置，使用本地确定性生成器');

  return {
    mode: feishuConfigured && llmConfigured ? 'live' : feishuConfigured ? 'hybrid' : 'simulation',
    port: positiveInteger(env.PORT, 4173),
    requestTimeoutMs: positiveInteger(env.REQUEST_TIMEOUT_MS, 15_000),
    feishu: {
      configured: feishuConfigured,
      appId: env.FEISHU_APP_ID || '',
      appSecret: env.FEISHU_APP_SECRET || '',
      appToken: env.FEISHU_BASE_APP_TOKEN || '',
      apiBaseUrl: (env.FEISHU_API_BASE_URL || 'https://open.feishu.cn/open-apis').replace(/\/$/, ''),
      tableIds: { ...DEFAULT_TABLE_IDS },
    },
    llm: {
      configured: llmConfigured,
      baseUrl: (env.LLM_BASE_URL || '').replace(/\/$/, ''),
      apiKey: env.LLM_API_KEY || '',
      model: env.LLM_MODEL || '',
      timeoutMs: positiveInteger(env.LLM_TIMEOUT_MS, 45_000),
    },
    warnings,
  };
}

export function toPublicRuntimeStatus(config) {
  return {
    mode: config.mode,
    simulation: config.mode === 'simulation',
    warnings: [...config.warnings],
    feishu: {
      configured: config.feishu.configured,
      appTokenHint: hint(config.feishu.appToken),
    },
    llm: {
      configured: config.llm.configured,
      model: config.llm.model || null,
    },
  };
}
