import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';
import { createFeishuPocDataset } from '../src/feishu-poc.mjs';
import { CSV_DEFINITIONS } from './export-feishu-data.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = path.join(ROOT, 'feishu', 'bitable');
const OUTPUT_FILE = path.join(SOURCE_DIR, 'OneKOS-多维表格导入包.xlsx');
const PREVIEW_DIR = path.join(ROOT, 'output', 'feishu-poc');

const sheetNames = ['顾问档案', '画像标签', '品牌知识', '内容任务', '内容成果', '评论线索', '反馈事件'];

function cellValue(value) {
  if (Array.isArray(value)) return value.join('｜');
  if (value && typeof value === 'object') return Object.entries(value).map(([key, item]) => `${key}:${item}`).join('｜');
  if (typeof value === 'boolean') return value ? '是' : '否';
  return value ?? '';
}

const workbook = Workbook.create();
const overview = workbook.worksheets.add('使用说明');
overview.showGridLines = false;
overview.getRange('A1:F1').merge();
overview.getRange('A1').values = [['千面·OneKOS｜飞书多维表格导入包']];
overview.getRange('A2:F2').merge();
overview.getRange('A2').values = [['所有记录均为贴近真实业务生成的模拟数据；导入飞书后按说明建立关联字段与工作流。']];
overview.getRange('A4:F4').values = [['序号', '数据表', '核心用途', '主字段', '主要使用者', '导入状态']];
overview.getRange('A5:F11').values = [
  [1, '顾问档案', '顾问基础资料、画像成熟度和授权状态', '顾问ID', '顾问/运营', '待导入'],
  [2, '画像标签', '带权重、置信度、来源和证据的动态画像', '标签ID', '顾问/Aily', '待导入'],
  [3, '品牌知识', '带来源、版本和有效期的事实核', '知识ID', '总部运营/Aily', '待导入'],
  [4, '内容任务', '一题千解路由后的每日任务', '任务ID', '顾问/Aily', '待导入'],
  [5, '内容成果', '脚本、分镜、素材和四重质检结果', '内容ID', '顾问/Aily', '待导入'],
  [6, '评论线索', '评论风向、线索字段和人工接管', '线索ID', '顾问/店长', '待导入'],
  [7, '反馈事件', '采用、修改、线索和成交对画像的反馈', '事件ID', '顾问/Aily', '待导入'],
];
overview.getRange('A13:F13').merge();
overview.getRange('A13').values = [['推荐顺序：先导入七张表 → 按“字段与视图配置.md”建立关联 → 配置 Aily 技能 → 配置四条工作流 → 发布机器人。']];
overview.getRange('A1:F1').format = { fill: '#26386C', font: { bold: true, color: '#FFFFFF', size: 18 }, rowHeight: 34 };
overview.getRange('A2:F2').format = { fill: '#EEF1FF', font: { color: '#4C5A7A' }, wrapText: true, rowHeight: 32 };
overview.getRange('A4:F4').format = { fill: '#5B6CF9', font: { bold: true, color: '#FFFFFF' }, horizontalAlignment: 'center' };
overview.getRange('A5:F11').format = { borders: { preset: 'insideHorizontal', style: 'thin', color: '#E4E8F0' }, wrapText: true, verticalAlignment: 'center' };
overview.getRange('A13:F13').format = { fill: '#FFF5D9', font: { color: '#74551C' }, wrapText: true, rowHeight: 34 };
overview.getRange('A:A').format.columnWidth = 8;
overview.getRange('B:B').format.columnWidth = 16;
overview.getRange('C:C').format.columnWidth = 38;
overview.getRange('D:D').format.columnWidth = 15;
overview.getRange('E:E').format.columnWidth = 18;
overview.getRange('F:F').format.columnWidth = 13;
overview.freezePanes.freezeRows(4);

const data = createFeishuPocDataset();
for (const [[, [table, columns]], sheetName] of Object.entries(CSV_DEFINITIONS).map((entry, index) => [entry, sheetNames[index]])) {
  const sheet = workbook.worksheets.add(sheetName);
  const rows = [columns.map(([, label]) => label), ...data[table].map((record) => columns.map(([field]) => cellValue(record[field])))];
  sheet.getRangeByIndexes(0, 0, rows.length, columns.length).values = rows;
  sheet.showGridLines = false;
  const used = sheet.getUsedRange();
  used.format = {
    font: { size: 10, color: '#1E2738' },
    verticalAlignment: 'center',
    wrapText: true,
    borders: { insideHorizontal: { style: 'thin', color: '#E8EBF2' } },
  };
  used.getRow(0).format = { fill: '#26386C', font: { bold: true, color: '#FFFFFF' }, rowHeight: 28 };
  used.format.autofitColumns();
  used.format.autofitRows();
  sheet.freezePanes.freezeRows(1);
}

await fs.mkdir(PREVIEW_DIR, { recursive: true });
const inspect = await workbook.inspect({ kind: 'table', range: '使用说明!A1:F13', include: 'values,formulas', tableMaxRows: 15, tableMaxCols: 8 });
await fs.writeFile(path.join(PREVIEW_DIR, 'workbook-inspect.ndjson'), inspect.ndjson, 'utf8');
const preview = await workbook.render({ sheetName: '使用说明', range: 'A1:F13', scale: 1.5, format: 'png' });
await fs.writeFile(path.join(PREVIEW_DIR, 'workbook-preview.png'), new Uint8Array(await preview.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(OUTPUT_FILE);
console.log(OUTPUT_FILE);
