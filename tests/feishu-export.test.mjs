import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCsvFiles } from '../scripts/export-feishu-data.mjs';

test('导出器为七张多维表生成带 UTF-8 BOM 的 CSV', () => {
  const files = buildCsvFiles();

  assert.equal(Object.keys(files).length, 7);
  for (const [filename, content] of Object.entries(files)) {
    assert.match(filename, /^0[1-7]-.+\.csv$/);
    assert.ok(content.startsWith('\ufeff'));
    assert.match(content, /模拟数据/);
  }
});

test('导出字段保留稳定主键、关联键和证据列', () => {
  const files = buildCsvFiles();

  assert.match(files['02-画像标签.csv'], /标签ID,顾问ID,维度,标签,权重,置信度,来源,证据/);
  assert.match(files['04-内容任务.csv'], /路由时间,顾问决策,拒绝原因,决策时间/);
  assert.match(files['05-内容成果.csv'], /内容ID,任务ID/);
  assert.match(files['06-评论线索.csv'], /线索ID,评论ID,顾问ID,内容ID/);
  assert.match(files['06-评论线索.csv'], /字段证据/);
  assert.match(files['07-反馈事件.csv'], /来源记录ID/);
});

test('包含逗号、引号或换行的单元格会按 CSV 规则转义', () => {
  const files = buildCsvFiles();
  const knowledge = files['03-品牌知识.csv'];

  assert.match(knowledge, /"4828×1930×1616mm，轴距 2950mm"/);
  assert.doesNotMatch(knowledge, /\[object Object\]/);
});
