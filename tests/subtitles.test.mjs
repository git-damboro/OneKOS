import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeSubtitleCues } from '../src/subtitles.mjs';

test('完整句与逐字时间戳并存时只保留一句可读字幕', () => {
  const cues = normalizeSubtitleCues([
    { startSec: 0.8, endSec: 3, text: '今天测试自动字幕。' },
    { startSec: 0.8, endSec: 1.2, text: '今天' },
    { startSec: 1.2, endSec: 1.8, text: '测试' },
    { startSec: 1.8, endSec: 2.3, text: '自动' },
    { startSec: 2.3, endSec: 3, text: '字幕' },
  ]);
  assert.deepEqual(cues, [{ startSec: 0.8, endSec: 3, text: '今天测试自动字幕。' }]);
});

test('带逗号的长转写按短句展示而不是逐字跳动', () => {
  const cues = normalizeSubtitleCues([
    { startSec: 0, endSec: 4, text: '我把水杯拿起来，看看系统能否识别。' },
    { startSec: 0, endSec: 0.5, text: '我把' },
    { startSec: 0.5, endSec: 1, text: '水杯' },
    { startSec: 1, endSec: 1.5, text: '拿起来' },
    { startSec: 1.5, endSec: 2, text: '看看' },
    { startSec: 2, endSec: 2.8, text: '系统' },
    { startSec: 2.8, endSec: 3.3, text: '能否' },
    { startSec: 3.3, endSec: 4, text: '识别' },
  ]);
  assert.deepEqual(cues, [
    { startSec: 0, endSec: 1.5, text: '我把水杯拿起来，' },
    { startSec: 1.5, endSec: 4, text: '看看系统能否识别。' },
  ]);
});

test('本来就是句级字幕时保持原样', () => {
  const cues = normalizeSubtitleCues([
    { startSec: 0, endSec: 2, text: '第一句话。' },
    { startSec: 2.2, endSec: 4, text: '第二句话。' },
  ]);
  assert.equal(cues.length, 2);
});
