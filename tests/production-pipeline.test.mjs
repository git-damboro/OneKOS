import assert from 'node:assert/strict';
import test from 'node:test';

import {
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
