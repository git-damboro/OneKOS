import { LlmApiError, OpenAICompatibleClient } from './llm-client.mjs';
import { normalizeSubtitleCues } from './subtitles.mjs';

function dataUrl(bytes, mimeType) {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`;
}

function text(value) { return typeof value === 'string' ? value.trim() : ''; }

function seconds(value, milliseconds = false) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return milliseconds || parsed > 10_000 ? parsed / 1000 : parsed;
}

function findSentences(value, found = []) {
  if (!value || typeof value !== 'object') return found;
  if (Array.isArray(value)) {
    for (const item of value) findSentences(item, found);
    return found;
  }
  const sentenceText = text(value.text || value.transcript);
  const hasMillisecondFields = value.begin_time !== undefined || value.end_time !== undefined;
  const startSec = seconds(value.begin_time ?? value.start_time ?? value.start, hasMillisecondFields);
  const endSec = seconds(value.end_time ?? value.end, hasMillisecondFields);
  if (sentenceText && startSec !== null && endSec !== null && endSec > startSec) {
    found.push({ startSec, endSec, text: sentenceText });
  }
  for (const child of Object.values(value)) findSentences(child, found);
  return found;
}

function findTranscript(value) {
  if (!value || typeof value !== 'object') return '';
  if (typeof value.text === 'string' && value.text.trim()) return value.text.trim();
  for (const child of Object.values(value)) {
    const result = findTranscript(child);
    if (result) return result;
  }
  return '';
}

export class DashScopeAsrClient {
  constructor({ baseUrl, apiKey, model = 'fun-asr-flash-2026-06-15', fetchImpl = globalThis.fetch, timeoutMs = 90_000 }) {
    if (!baseUrl || !apiKey || !model) throw new Error('ASR Base URL、API Key 和模型名称均不能为空');
    this.url = `${baseUrl.replace(/\/$/, '')}/api/v1/services/aigc/multimodal-generation/generation`;
    this.apiKey = apiKey;
    this.model = model;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async transcribe({ audioBytes, mimeType = 'audio/wav', durationSec = 0 }) {
    let response;
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        response = await this.fetchImpl(this.url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json', 'X-DashScope-SSE': 'disable' },
          body: JSON.stringify({
            model: this.model,
            input: { messages: [{ role: 'user', content: [{ type: 'input_audio', input_audio: { data: dataUrl(audioBytes, mimeType) } }] }] },
            parameters: { format: 'wav', sample_rate: 16000 },
          }),
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }
    if (!response) throw new LlmApiError(`语音识别请求失败：${lastError?.message || 'unknown error'}`, { details: { cause: lastError?.name, code: lastError?.cause?.code || '', detail: lastError?.cause?.message || '' } });
    const body = await response.json().catch(() => null);
    if (response.status === 400 && body?.code === 'CLIENT_ERROR' && body?.message === 'ASR_RESPONSE_HAVE_NO_WORDS') {
      return { model: this.model, transcript: '', sentences: [] };
    }
    if (!response.ok || !body) throw new LlmApiError(`语音识别 API 错误：${body?.message || response.statusText}`, { status: response.status, details: body });
    const foundSentences = findSentences(body).filter((item, index, list) => index === list.findIndex((other) => other.startSec === item.startSec && other.endSec === item.endSec && other.text === item.text));
    const transcript = findTranscript(body) || foundSentences.map((item) => item.text).join('');
    const sentences = normalizeSubtitleCues(foundSentences, transcript);
    return {
      model: this.model,
      transcript,
      sentences: sentences.length ? sentences : transcript ? [{ startSec: 0, endSec: Math.max(0.5, Number(durationSec) || 5), text: transcript }] : [],
    };
  }
}

export class QwenVisionClient {
  constructor(options) {
    this.client = new OpenAICompatibleClient(options);
    this.model = options.model;
  }

  async analyze({ frames, requirement, durationSec }) {
    const content = [{ type: 'text', text: JSON.stringify({
      task: '按时间顺序分析同一段顾问自拍视频的抽帧，只标注看得见的内容，并推荐最适合剪进成片的连续区间。只返回 JSON。',
      expected: { visualDescription: requirement.visualDescription, shootingGuide: requirement.shootingGuide, scriptText: requirement.scriptText },
      durationSec,
      outputSchema: { summary: '画面摘要', segments: [{ startSec: 0, endSec: 2, visual: '可见内容', usable: true, confidence: 0.9 }], recommendedClip: { startSec: 0, endSec: 8 }, warnings: ['画面问题'] },
    }) }];
    for (const frame of frames) {
      content.push({ type: 'text', text: `时间点 ${frame.timestampSec.toFixed(1)} 秒` });
      content.push({ type: 'image_url', image_url: { url: dataUrl(frame.bytes, frame.mimeType || 'image/jpeg') } });
    }
    return this.client.generateJson({
      system: '你是视频画面分析器。不得猜测未展示内容，推荐区间必须在素材时长内。',
      userContent: content,
      temperature: 0.1,
    });
  }
}

export class MediaAnalysisClient {
  constructor({ asrClient, visionClient }) {
    this.asrClient = asrClient;
    this.visionClient = visionClient;
  }

  async analyze({ prepared, requirement }) {
    const [speechResult, visionResult] = await Promise.allSettled([
      prepared.audioBytes?.byteLength
        ? this.asrClient.transcribe({ audioBytes: prepared.audioBytes, durationSec: prepared.durationSec })
        : Promise.resolve({ model: this.asrClient.model, transcript: '', sentences: [] }),
      prepared.frames?.length
        ? this.visionClient.analyze({ frames: prepared.frames, requirement, durationSec: prepared.durationSec })
        : Promise.resolve({ summary: '', segments: [], recommendedClip: { startSec: 0, endSec: prepared.durationSec }, warnings: [] }),
    ]);
    const speech = speechResult.status === 'fulfilled' ? speechResult.value : { model: this.asrClient.model, transcript: '', sentences: [], error: speechResult.reason?.message };
    const vision = visionResult.status === 'fulfilled' ? visionResult.value : { summary: '', segments: [], warnings: [], error: visionResult.reason?.message };
    const rawClip = vision.recommendedClip || {};
    const startSec = Math.max(0, Math.min(Number(rawClip.startSec) || 0, prepared.durationSec));
    const endSec = Math.max(startSec + 0.5, Math.min(Number(rawClip.endSec) || prepared.durationSec, prepared.durationSec));
    return {
      status: speech.error || vision.error ? '部分完成' : '已完成',
      asr: speech,
      vision: { model: this.visionClient.model, ...vision },
      recommendedClip: { startSec, endSec },
      analyzedAt: new Date().toISOString(),
    };
  }
}
