import assert from 'node:assert/strict';
import test from 'node:test';

import { displayDimensions } from '../src/video-editor.mjs';

test('手机视频带 90 度旋转元数据时按实际显示尺寸判断方向', () => {
  assert.deepEqual(displayDimensions(1920, 1080, 90), { width: 1080, height: 1920, rotation: 90 });
  assert.deepEqual(displayDimensions(1920, 1080, -90), { width: 1080, height: 1920, rotation: 270 });
});

test('没有旋转或旋转 180 度时保持编码尺寸', () => {
  assert.deepEqual(displayDimensions(1080, 1920, 0), { width: 1080, height: 1920, rotation: 0 });
  assert.deepEqual(displayDimensions(1080, 1920, 180), { width: 1080, height: 1920, rotation: 180 });
});
