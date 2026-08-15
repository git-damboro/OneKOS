import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildEditingJob,
  buildShootingRequirements,
  compareRequirementsAndAssets,
  inspectUploadedAsset,
  normalizeProductionCandidate,
} from '../src/production-pipeline.mjs';

const task = { topic: '测试选题', matrixGap: '测试空白' };

test('JSON2 标准化保留嵌套镜头并生成稳定业务主键', () => {
  const result = normalizeProductionCandidate({
    title: '测试标题',
    script: { fullText: '完整口播' },
    shots: [{
      durationSec: 8,
      scriptText: '第一句',
      visualDescription: '顾问车旁开场',
      shootingGuide: '手机竖拍，人物居中。',
      requiredAssets: [{ type: 'video', required: true, minDurationSec: 5, orientation: 'portrait', description: '开场视频' }],
    }],
  }, { task, contentId: 'CONTENT-X' });

  assert.equal(result.script, '完整口播');
  assert.equal(result.shots[0].shotId, 'CONTENT-X-SHOT-001');
  assert.equal(result.shots[0].requiredAssets[0].slotId, 'CONTENT-X-SLOT-001');
  assert.notEqual(result.storyboard[0], '[object Object]');
});

test('后期剪辑指令不会变成顾问上传素材槽位', () => {
  const result = normalizeProductionCandidate({
    shots: [
      {
        visualDescription: '拍摄收纳完成后的后备箱全景',
        shootingGuide: '手机竖拍并保持稳定。',
        requiredAssets: [{ type: 'video', description: '后备箱收纳完成后的连续原始画面' }],
      },
      {
        visualDescription: '快速剪辑前面的收纳画面并加入转场',
        shootingGuide: '后期加字幕和配乐。',
        requiredAssets: [{ type: 'video', description: '快速剪辑前面的全景画面，最后出现顾问' }],
      },
    ],
  }, { task, contentId: 'CONTENT-EDIT' });

  const requirements = buildShootingRequirements({ ...result, taskId: 'TASK-EDIT', simulation: false });
  assert.equal(requirements.length, 1);
  assert.match(requirements[0].description, /连续原始画面/);
  assert.equal(result.editInstructions.length, 1);
  assert.match(result.editInstructions[0].instruction, /快速剪辑/);
});

test('真实素材用纯代码检查文件、时长、方向和分辨率', () => {
  const requirement = {
    slotId: 'CONTENT-Z-SLOT-001', type: 'video', minDurationSec: 8, orientation: 'portrait',
  };
  const passed = inspectUploadedAsset(requirement, {
    assetId: 'ASSET-Z', fileToken: 'box-token', fileSize: 1024, mimeType: 'video/mp4', durationSec: 9, width: 1080, height: 1920,
  });
  assert.equal(passed.status, 'available');
  assert.equal(passed.technicalCheckStatus, '检查通过');

  const failed = inspectUploadedAsset(requirement, {
    assetId: 'ASSET-Z', fileToken: 'box-token', fileSize: 1024, mimeType: 'video/mp4', durationSec: 3, width: 640, height: 360,
  });
  assert.equal(failed.status, 'invalid');
  assert.match(failed.invalidReason, /时长至少需要 8 秒/);
  assert.match(failed.invalidReason, /短边至少需要 720/);
  assert.match(failed.invalidReason, /竖屏/);
});

test('素材比较由确定性规则识别缺失、时长和方向问题', () => {
  const content = normalizeProductionCandidate({
    shots: [{ visualDescription: '镜头', requiredAssets: [{ type: 'video', required: true, minDurationSec: 8, orientation: 'portrait' }] }],
  }, { task, contentId: 'CONTENT-Y' });
  const requirements = buildShootingRequirements({ ...content, contentId: 'CONTENT-Y', taskId: 'TASK-Y', simulation: true });

  assert.equal(compareRequirementsAndAssets(requirements, []).missing.length, 1);
  const invalid = compareRequirementsAndAssets(requirements, [{
    assetId: 'ASSET-Y', slotId: 'CONTENT-Y-SLOT-001', status: 'available', type: 'video', durationSec: 3, orientation: 'landscape',
  }]);
  assert.equal(invalid.complete, false);
  assert.equal(invalid.invalid.length, 1);
  assert.equal(invalid.invalid[0].reasons.length, 2);
});

test('剪辑任务优先使用素材解析得到的截取区间和真实字幕', () => {
  const content = { contentId: 'CONTENT-AI', aspectRatio: '9:16', estimatedDurationSec: 10, editInstructions: [], shots: [{ shotId: 'SHOT-1', durationSec: 8, scriptText: '策划台词', requiredAssets: [{ slotId: 'SLOT-1' }] }] };
  const assets = [{ assetId: 'ASSET-1', slotId: 'SLOT-1', analysis: { recommendedClip: { startSec: 2, endSec: 7 }, asr: { transcript: '真实口播', sentences: [{ startSec: 2.2, endSec: 4, text: '真实口播' }] }, vision: { summary: '真实画面' } } }];
  const job = buildEditingJob({ content, assets, comparison: { matched: [{ assetId: 'ASSET-1' }] }, timestamp: '2026-08-15T00:00:00.000Z' });
  assert.equal(job.editingPlan.shots[0].startSec, 2);
  assert.equal(job.editingPlan.shots[0].durationSec, 5);
  assert.equal(job.editingPlan.shots[0].scriptText, '真实口播');
  assert.equal(job.editingPlan.shots[0].subtitles[0].startSec, 2.2);
});

test('模型即使输出过多视频槽位也只保留最多五段必填', () => {
  const content = normalizeProductionCandidate({
    shots: Array.from({ length: 7 }, (_, index) => ({ visualDescription: `镜头${index + 1}`, requiredAssets: [{ type: 'video', required: true }] })),
  }, { task, contentId: 'CONTENT-BURDEN' });
  const requiredVideos = content.shots.flatMap((shot) => shot.requiredAssets).filter((asset) => asset.type === 'video' && asset.required);
  assert.equal(requiredVideos.length, 5);
});
