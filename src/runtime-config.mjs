export const DEFAULT_TABLE_IDS = Object.freeze({
  guide: 'tbl4ZhnnRrQUH5UE',
  advisors: 'tbl1Zo2ok0NNCx4X',
  profileTags: 'tbl4XQnP5hWkVvGn',
  brandKnowledge: 'tbl41FAWlj0gMQaL',
  contentTasks: 'tbl6M9VXJVVs90VU',
  contentResults: 'tbl7Lio87hTuAlCz',
  commentLeads: 'tbl3Zkta6p45B6Ln',
  feedbackEvents: 'tbl3jWEOKNqN33w1',
  shootingRequirements: 'tblSjPyEqK3ziKvm',
  advisorAssets: 'tbl1SGfQHpkIM1fx',
  editingJobs: 'tbl3uPLnCieCSTNX',
});

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function booleanValue(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function hint(value) {
  if (!value) return null;
  if (value.length <= 8) return '已配置';
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function createRuntimeConfig(env = process.env) {
  const onboardingSessionsTableId = env.FEISHU_TABLE_ONBOARDING_SESSIONS || '';
  const hasFeishuCredentials = Boolean(env.FEISHU_APP_ID && env.FEISHU_APP_SECRET && env.FEISHU_BASE_APP_TOKEN);
  const feishuConfigured = Boolean(hasFeishuCredentials && onboardingSessionsTableId);
  const feishuLoginConfigured = Boolean(env.FEISHU_APP_ID && env.FEISHU_APP_SECRET && env.FEISHU_OAUTH_REDIRECT_URI);
  const llmConfigured = Boolean(env.LLM_BASE_URL && env.LLM_API_KEY && env.LLM_MODEL);
  const mediaApiKey = env.MEDIA_AI_API_KEY || env.LLM_API_KEY || '';
  const mediaBaseUrl = (env.MEDIA_AI_DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com').replace(/\/$/, '');
  const mediaAnalysisConfigured = Boolean(mediaApiKey && mediaBaseUrl && (env.MEDIA_AI_COMPATIBLE_BASE_URL || env.LLM_BASE_URL));
  const warnings = [];

  if (!feishuConfigured) warnings.push(hasFeishuCredentials ? '飞书问卷会话表未配置，使用仓库内模拟数据' : '飞书未配置，使用仓库内模拟数据');
  if (!llmConfigured) warnings.push('外部模型未配置，使用本地确定性生成器');
  if (!env.AILY_API_KEY) warnings.push('Aily API 鉴权未配置；正式环境应设置 AILY_API_KEY');

  return {
    mode: feishuConfigured && llmConfigured ? 'live' : feishuConfigured ? 'hybrid' : 'simulation',
    port: positiveInteger(env.PORT, 4173),
    requestTimeoutMs: positiveInteger(env.REQUEST_TIMEOUT_MS, 15_000),
    feishu: {
      configured: feishuConfigured,
      appId: env.FEISHU_APP_ID || '',
      appSecret: env.FEISHU_APP_SECRET || '',
      appToken: env.FEISHU_BASE_APP_TOKEN || '',
      loginConfigured: feishuLoginConfigured,
      oauthRedirectUri: env.FEISHU_OAUTH_REDIRECT_URI || '',
      apiBaseUrl: (env.FEISHU_API_BASE_URL || 'https://open.feishu.cn/open-apis').replace(/\/$/, ''),
      tableIds: { ...DEFAULT_TABLE_IDS, onboardingSessions: onboardingSessionsTableId },
    },
    llm: {
      configured: llmConfigured,
      baseUrl: (env.LLM_BASE_URL || '').replace(/\/$/, ''),
      apiKey: env.LLM_API_KEY || '',
      model: env.LLM_MODEL || '',
      timeoutMs: positiveInteger(env.LLM_TIMEOUT_MS, 45_000),
      enableThinking: booleanValue(env.LLM_ENABLE_THINKING, false),
    },
    mediaAnalysis: {
      configured: mediaAnalysisConfigured,
      apiKey: mediaApiKey,
      dashscopeBaseUrl: mediaBaseUrl,
      compatibleBaseUrl: (env.MEDIA_AI_COMPATIBLE_BASE_URL || env.LLM_BASE_URL || '').replace(/\/$/, ''),
      asrModel: env.ASR_MODEL || 'fun-asr-flash-2026-06-15',
      visionModel: env.VISION_MODEL || 'qwen3-vl-flash',
      timeoutMs: positiveInteger(env.MEDIA_AI_TIMEOUT_MS, 90_000),
      frameIntervalSec: positiveInteger(env.VISION_FRAME_INTERVAL_SEC, 2),
      maxFrames: positiveInteger(env.VISION_MAX_FRAMES, 8),
    },
    video: {
      ffmpegPath: env.FFMPEG_PATH || 'ffmpeg',
      ffprobePath: env.FFPROBE_PATH || 'ffprobe',
      workDir: env.VIDEO_WORK_DIR || 'output/video-jobs',
      width: positiveInteger(env.VIDEO_WIDTH, 720),
      height: positiveInteger(env.VIDEO_HEIGHT, 1280),
      fps: positiveInteger(env.VIDEO_FPS, 30),
      fontDir: env.VIDEO_FONT_DIR || undefined,
      fontName: env.VIDEO_FONT_NAME || undefined,
    },
    aily: {
      apiKey: env.AILY_API_KEY || '',
      attachmentHostSuffixes: String(env.AILY_ATTACHMENT_HOSTS || '')
        .split(',').map((item) => item.trim().toLowerCase()).filter(Boolean),
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
      loginConfigured: config.feishu.loginConfigured,
      appTokenHint: hint(config.feishu.appToken),
    },
    llm: {
      configured: config.llm.configured,
      model: config.llm.model || null,
    },
    mediaAnalysis: {
      configured: config.mediaAnalysis.configured,
      asrModel: config.mediaAnalysis.asrModel,
      visionModel: config.mediaAnalysis.visionModel,
    },
    video: {
      editor: 'local-ffmpeg',
      output: `${config.video.width}x${config.video.height}`,
    },
    aily: {
      configured: true,
      authConfigured: Boolean(config.aily.apiKey),
      persistence: 'feishu-onboarding-session-table',
    },
  };
}
