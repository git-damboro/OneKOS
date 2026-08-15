function text(value, fallback = '') {
  if (typeof value === 'string') return value.trim() || fallback;
  if (value === null || value === undefined) return fallback;
  return String(value).trim() || fallback;
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function list(value) {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).map((item) => text(item)).filter(Boolean);
}

function pad(value) {
  return String(value).padStart(3, '0');
}

export function assetType(value) {
  const normalized = text(value, 'video').toLowerCase();
  if (normalized.startsWith('image/')) return 'image';
  if (normalized.startsWith('audio/')) return 'audio';
  if (normalized.startsWith('video/')) return 'video';
  if (normalized.startsWith('text/')) return 'text';
  if (['image', '图片', 'photo'].includes(normalized)) return 'image';
  if (['audio', '音频', 'voice'].includes(normalized)) return 'audio';
  if (['text', '文本'].includes(normalized)) return 'text';
  return 'video';
}

function orientation(value) {
  const normalized = text(value, 'portrait').toLowerCase();
  if (['landscape', '横屏', '横屏16:9', '16:9'].includes(normalized)) return 'landscape';
  if (['any', '不限'].includes(normalized)) return 'any';
  return 'portrait';
}

function scriptText(candidate) {
  if (typeof candidate.script === 'string') return candidate.script;
  if (candidate.script && typeof candidate.script === 'object') {
    return text(candidate.script.fullText || candidate.script.full_text || candidate.script.text);
  }
  return '';
}

const EDITING_ONLY_PATTERN = /(?:快速剪辑|后期剪辑|剪辑前面|拼接(?:前面|以上|这些)|添加?字幕|加字幕|添加?配乐|加配乐|转场|快切|蒙太奇|导出成片|合成视频)/;

function isEditingOnlyAsset(rawAsset, rawShot) {
  const combined = [
    rawAsset.description,
    rawAsset.uploadTip || rawAsset.upload_tip,
    rawShot.visualDescription,
    rawShot.shootingGuide || rawShot.shooting_guide,
  ].map(text).join('；');
  return EDITING_ONLY_PATTERN.test(combined);
}

export function normalizeProductionCandidate(candidate, { task, contentId }) {
  const rawShots = Array.isArray(candidate.shots) && candidate.shots.length
    ? candidate.shots
    : list(candidate.storyboard).map((description, index) => ({
        order: index + 1,
        visualDescription: description,
        scriptText: '',
        requiredAssets: [{ type: 'video', description }],
      }));

  let assetSequence = 0;
  const rawEditInstructions = candidate.editInstructions || candidate.edit_instructions || [];
  const editInstructions = (Array.isArray(rawEditInstructions) ? rawEditInstructions : [rawEditInstructions])
    .map((item) => (typeof item === 'string'
      ? { instruction: text(item) }
      : {
          shotOrder: number(item?.shotOrder || item?.shot_order),
          instruction: text(item?.instruction || item?.description),
          sourceShotOrders: (Array.isArray(item?.sourceShotOrders) ? item.sourceShotOrders : []).map((value) => number(value)).filter(Boolean),
        }))
    .filter((item) => item.instruction);
  const shots = rawShots.map((rawShot, index) => {
    const order = index + 1;
    const shotId = `${contentId}-SHOT-${pad(order)}`;
    const visualDescription = text(rawShot.visualDescription || rawShot.visual || rawShot.description, `镜头 ${order}`);
    const shootingGuide = text(
      rawShot.shootingGuide || rawShot.shooting_guide,
      `手机竖直并保持稳定，按照“${visualDescription}”拍摄，完成后多停留 2 秒。`,
    );
    const rawAssets = Array.isArray(rawShot.requiredAssets) && rawShot.requiredAssets.length
      ? rawShot.requiredAssets
      : [{ type: 'video', description: visualDescription }];
    const captureAssets = rawAssets.filter((rawAsset) => {
      if (!isEditingOnlyAsset(rawAsset, rawShot)) return true;
      editInstructions.push({ shotId, instruction: text(rawAsset.description, visualDescription) });
      return false;
    });
    const requiredAssets = captureAssets.map((rawAsset) => {
      assetSequence += 1;
      const type = assetType(rawAsset.type);
      const suggestedDurationSec = number(rawAsset.suggestedDurationSec || rawAsset.durationSec, type === 'video' ? 8 : 0);
      const minDurationSec = number(rawAsset.minDurationSec, type === 'video' ? Math.min(5, suggestedDurationSec || 5) : 0);
      return {
        slotId: `${contentId}-SLOT-${pad(assetSequence)}`,
        type,
        required: rawAsset.required !== false,
        suggestedDurationSec,
        minDurationSec,
        orientation: orientation(rawAsset.orientation),
        description: text(rawAsset.description, visualDescription),
        uploadTip: text(rawAsset.uploadTip || rawAsset.upload_tip, '拍完先回看，确保主体清楚、画面稳定、没有遮挡。'),
      };
    });
    return {
      shotId,
      order,
      durationSec: number(rawShot.durationSec, requiredAssets[0]?.suggestedDurationSec || 8),
      scriptText: text(rawShot.scriptText || rawShot.script || rawShot.line),
      visualDescription,
      shootingGuide,
      notes: text(rawShot.notes || rawShot.note),
      requiredAssets,
    };
  });
  let requiredVideoCount = 0;
  for (const shot of shots) {
    for (const asset of shot.requiredAssets) {
      if (asset.type !== 'video' || !asset.required) continue;
      requiredVideoCount += 1;
      if (requiredVideoCount > 5) asset.required = false;
    }
  }

  const script = scriptText(candidate) || shots.map((shot) => shot.scriptText).filter(Boolean).join('\n');
  return {
    schemaVersion: '2.0',
    title: text(candidate.title, task.topic),
    hook: text(candidate.hook, '先记录真实场景，再给条件化结论。'),
    script,
    estimatedDurationSec: number(candidate.estimatedDurationSec, shots.reduce((sum, shot) => sum + shot.durationSec, 0) || 60),
    aspectRatio: orientation(candidate.aspectRatio) === 'landscape' ? '16:9' : '9:16',
    shots,
    storyboard: shots.map((shot) => `${shot.order}. ${shot.visualDescription}`),
    materials: shots.flatMap((shot) => shot.requiredAssets.map((asset) => `${asset.slotId}：${asset.description}`)),
    replyPlan: list(candidate.replyPlan),
    cta: text(candidate.cta, '留下你的真实用车条件，由顾问人工判断。'),
    factRefs: list(candidate.factRefs),
    profileRefs: list(candidate.profileRefs),
    selectedReason: text(candidate.selectedReason, `命中矩阵空白“${task.matrixGap}”，并匹配顾问当前生效画像。`),
    editInstructions,
  };
}

export function buildShootingRequirements(content) {
  return content.shots.flatMap((shot) => shot.requiredAssets.map((asset) => ({
    ...asset,
    contentId: content.contentId,
    taskId: content.taskId,
    shotId: shot.shotId,
    shotOrder: shot.order,
    scriptText: shot.scriptText,
    visualDescription: shot.visualDescription,
    shootingGuide: shot.shootingGuide,
    notes: [shot.notes, asset.uploadTip].filter(Boolean).join('；'),
    status: '待上传',
    simulation: content.simulation,
  })));
}

export function buildAssetPlaceholders(requirements, { advisorId, contentId }) {
  return requirements.map((requirement, index) => ({
    assetId: `${contentId}-ASSET-${pad(index + 1)}`,
    contentId,
    slotId: requirement.slotId,
    shotId: requirement.shotId,
    advisorId,
    fileToken: null,
    fileName: '',
    mimeType: '',
    fileSize: 0,
    type: requirement.type,
    durationSec: 0,
    width: 0,
    height: 0,
    orientation: requirement.orientation,
    resolution: '',
    technicalCheckStatus: '待检查',
    advisorConfirmationStatus: '待确认',
    requiresReshoot: false,
    invalidReason: '',
    status: 'waiting_upload',
    simulation: requirement.simulation,
  }));
}

function actualOrientation(width, height) {
  if (!width || !height || width === height) return 'any';
  return width > height ? 'landscape' : 'portrait';
}

export function inspectUploadedAsset(requirement, rawAsset) {
  const type = assetType(rawAsset.type || rawAsset.mimeType);
  const width = number(rawAsset.width);
  const height = number(rawAsset.height);
  const detectedOrientation = actualOrientation(width, height);
  const orientationValue = detectedOrientation === 'any' ? orientation(rawAsset.orientation) : detectedOrientation;
  const durationSec = number(rawAsset.durationSec);
  const fileSize = number(rawAsset.fileSize);
  const reasons = [];

  if (!rawAsset.fileToken) reasons.push('文件尚未成功保存到飞书');
  if (!fileSize) reasons.push('文件为空或无法读取文件大小');
  if (fileSize > 100 * 1024 * 1024) reasons.push('单个文件不能超过 100MB');
  if (type !== requirement.type) reasons.push(`需要${requirement.type}，实际为${type}`);

  if (['video', 'audio'].includes(type)) {
    if (!durationSec) reasons.push('无法读取媒体时长');
    if (durationSec && durationSec < number(requirement.minDurationSec)) reasons.push(`时长至少需要 ${requirement.minDurationSec} 秒`);
  }
  if (['video', 'image'].includes(type)) {
    if (!width || !height) reasons.push('无法读取画面尺寸');
    if (width && height && Math.min(width, height) < 720) reasons.push('画面短边至少需要 720 像素');
    if (requirement.orientation !== 'any' && detectedOrientation !== 'any' && detectedOrientation !== requirement.orientation) {
      reasons.push(`画面方向应为${requirement.orientation === 'portrait' ? '竖屏' : '横屏'}`);
    }
  }

  return {
    ...rawAsset,
    type,
    durationSec,
    width,
    height,
    orientation: orientationValue,
    resolution: width && height ? `${width}x${height}` : '',
    technicalCheckStatus: reasons.length ? '检查不通过' : '检查通过',
    advisorConfirmationStatus: '待确认',
    requiresReshoot: reasons.length > 0,
    invalidReason: reasons.join('；'),
    status: reasons.length ? 'invalid' : 'available',
    simulation: false,
  };
}

export function buildSimulatedAssets(requirements, { advisorId, contentId }) {
  return requirements.filter((item) => item.required).map((requirement, index) => ({
    assetId: `${contentId}-ASSET-${pad(index + 1)}`,
    contentId,
    slotId: requirement.slotId,
    shotId: requirement.shotId,
    advisorId,
    fileToken: null,
    type: requirement.type,
    durationSec: requirement.type === 'video' ? Math.max(requirement.minDurationSec, requirement.suggestedDurationSec, 6) : 0,
    orientation: requirement.orientation,
    resolution: requirement.orientation === 'landscape' ? '1920x1080（模拟）' : '1080x1920（模拟）',
    technicalCheckStatus: '检查通过',
    advisorConfirmationStatus: '采用',
    requiresReshoot: false,
    invalidReason: '',
    status: 'available',
    simulation: true,
  }));
}

export function compareRequirementsAndAssets(requirements, assets) {
  const missing = [];
  const invalid = [];
  const matched = [];
  for (const requirement of requirements.filter((item) => item.required)) {
    const slotAssets = assets.filter((item) => item.slotId === requirement.slotId);
    const asset = slotAssets.find((item) => item.status === 'available');
    if (!asset) {
      const invalidAsset = slotAssets.find((item) => item.status === 'invalid');
      if (invalidAsset) invalid.push({ slotId: requirement.slotId, assetId: invalidAsset.assetId, reasons: [invalidAsset.invalidReason] });
      else missing.push({ slotId: requirement.slotId, reason: '尚未上传可用素材' });
      continue;
    }
    const reasons = [];
    if (asset.type !== requirement.type) reasons.push(`需要 ${requirement.type}，实际为 ${asset.type}`);
    if (requirement.type === 'video' && number(asset.durationSec) < number(requirement.minDurationSec)) {
      reasons.push(`视频至少需要 ${requirement.minDurationSec} 秒`);
    }
    if (requirement.orientation !== 'any' && asset.orientation !== requirement.orientation) {
      reasons.push(`画面方向应为 ${requirement.orientation}`);
    }
    if (reasons.length) invalid.push({ slotId: requirement.slotId, assetId: asset.assetId, reasons });
    else matched.push({ slotId: requirement.slotId, assetId: asset.assetId });
  }
  return {
    complete: missing.length === 0 && invalid.length === 0,
    requiredCount: requirements.filter((item) => item.required).length,
    matchedCount: matched.length,
    missing,
    invalid,
    matched,
  };
}

export function buildEditingJob({ content, assets, comparison, timestamp }) {
  return {
    editingJobId: `${content.contentId}-RENDER-001`,
    contentId: content.contentId,
    contentVersion: 1,
    assetIds: comparison.matched.map((item) => item.assetId),
    editingPlan: {
      schemaVersion: '1.0',
      contentId: content.contentId,
      aspectRatio: content.aspectRatio,
      estimatedDurationSec: content.estimatedDurationSec,
      shots: content.shots.map((shot) => {
        const shotAssets = assets.filter((asset) => shot.requiredAssets.some((slot) => slot.slotId === asset.slotId));
        const analyzed = shotAssets.find((asset) => asset.analysis?.recommendedClip);
        const clip = analyzed?.analysis?.recommendedClip;
        const startSec = Number(clip?.startSec) || 0;
        const analyzedDuration = Math.max(0, (Number(clip?.endSec) || 0) - startSec);
        return {
          shotId: shot.shotId,
          startSec,
          durationSec: analyzedDuration || shot.durationSec,
          scriptText: analyzed?.analysis?.asr?.transcript || shot.scriptText,
          subtitles: analyzed?.analysis?.asr?.sentences || [],
          visualAnalysis: analyzed?.analysis?.vision || null,
          assetIds: shotAssets.map((asset) => asset.assetId),
        };
      }),
      editInstructions: content.editInstructions || [],
    },
    editor: '待接入视频剪辑模型或 Skill',
    status: comparison.complete ? '待剪辑' : '等待素材',
    progress: 0,
    failureReason: '',
    retryCount: 0,
    previewFileToken: null,
    finalFileToken: null,
    advisorConfirmationStatus: '待确认',
    completedAt: null,
    simulation: assets.some((asset) => asset.simulation),
    createdAt: timestamp,
  };
}
