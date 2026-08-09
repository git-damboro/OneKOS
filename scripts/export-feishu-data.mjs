import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFeishuPocDataset } from '../src/feishu-poc.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = path.join(ROOT, 'feishu', 'bitable');

export const CSV_DEFINITIONS = {
  '01-顾问档案.csv': ['advisors', [
    ['advisorId', '顾问ID'], ['displayName', '展示名称'], ['city', '城市'], ['store', '门店'],
    ['experienceYears', '从业年限'], ['targetAudience', '目标用户'], ['profileMaturity', '画像成熟度'],
    ['authorizationStatus', '授权状态'], ['workflowStatus', '流程状态'], ['simulation', '模拟数据'],
  ]],
  '02-画像标签.csv': ['profileTags', [
    ['tagId', '标签ID'], ['advisorId', '顾问ID'], ['dimension', '维度'], ['label', '标签'],
    ['weight', '权重'], ['confidence', '置信度'], ['source', '来源'], ['evidence', '证据'],
    ['status', '状态'], ['updatedAt', '更新时间'], ['simulation', '模拟数据'],
  ]],
  '03-品牌知识.csv': ['brandKnowledge', [
    ['knowledgeId', '知识ID'], ['model', '车型'], ['field', '字段'], ['value', '事实值'],
    ['version', '版本'], ['source', '来源'], ['sourceUrl', '来源URL'], ['checkedAt', '核验日期'],
    ['validUntil', '有效期至'], ['status', '状态'], ['simulation', '模拟数据'],
  ]],
  '04-内容任务.csv': ['contentTasks', [
    ['taskId', '任务ID'], ['advisorId', '顾问ID'], ['taskDate', '任务日期'], ['userQuestion', '用户问题'],
    ['topic', '内容角度'], ['targetModel', '目标车型'], ['routeScore', '路由匹配分'],
    ['profileEvidence', '画像证据ID'], ['matrixGap', '矩阵空白'], ['routedAt', '路由时间'],
    ['decision', '顾问决策'], ['rejectionReason', '拒绝原因'], ['decidedAt', '决策时间'],
    ['status', '状态'], ['simulation', '模拟数据'],
  ]],
  '05-内容成果.csv': ['contentResults', [
    ['contentId', '内容ID'], ['taskId', '任务ID'], ['title', '标题'], ['hook', '开场'], ['script', '口播脚本'],
    ['storyboard', '分镜'], ['materials', '素材清单'], ['factRefs', '事实引用ID'], ['profileRefs', '画像引用ID'],
    ['factScore', '事实质检分'], ['complianceScore', '合规质检分'], ['personaScore', '人设质检分'],
    ['matrixScore', '矩阵质检分'], ['status', '状态'], ['simulation', '模拟数据'],
  ]],
  '06-评论线索.csv': ['commentLeads', [
    ['leadId', '线索ID'], ['commentId', '评论ID'], ['advisorId', '顾问ID'], ['contentId', '内容ID'],
    ['platform', '平台'], ['sourceUser', '用户'], ['sourceText', '原评论'], ['city', '城市'],
    ['familyStructure', '家庭结构'], ['model', '车型'], ['purchaseWindow', '购车时间'],
    ['testDriveIntent', '试驾意愿'], ['leadScore', '线索分'], ['leadGrade', '线索等级'],
    ['fieldEvidence', '字段证据'], ['nextAction', '下一步建议'], ['status', '状态'],
    ['authorizationStatus', '授权状态'], ['lastSyncedAt', '最后同步时间'], ['simulation', '模拟数据'],
  ]],
  '07-反馈事件.csv': ['feedbackEvents', [
    ['eventId', '事件ID'], ['advisorId', '顾问ID'], ['sourceRecordId', '来源记录ID'], ['eventType', '事件类型'],
    ['affectedTagId', '影响标签ID'], ['weightDelta', '权重变化'], ['evidence', '证据'],
    ['createdAt', '创建时间'], ['status', '状态'], ['simulation', '模拟数据'],
  ]],
};

function normalize(value) {
  if (Array.isArray(value)) return value.join('｜');
  if (value && typeof value === 'object') return Object.entries(value).map(([key, item]) => `${key}:${item}`).join('｜');
  if (typeof value === 'boolean') return value ? '是' : '否';
  return value ?? '';
}

function escapeCsv(value) {
  const text = String(normalize(value));
  return /[",，\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(records, columns) {
  const rows = [columns.map(([, label]) => label)];
  for (const record of records) rows.push(columns.map(([field]) => record[field]));
  return `\ufeff${rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')}\r\n`;
}

export function buildCsvFiles() {
  const data = createFeishuPocDataset();
  return Object.fromEntries(Object.entries(CSV_DEFINITIONS).map(([filename, [table, columns]]) => [filename, toCsv(data[table], columns)]));
}

export async function exportCsvFiles(outputDir = OUTPUT_DIR) {
  await mkdir(outputDir, { recursive: true });
  const files = buildCsvFiles();
  await Promise.all(Object.entries(files).map(([filename, content]) => writeFile(path.join(outputDir, filename), content, 'utf8')));
  return Object.keys(files).map((filename) => path.join(outputDir, filename));
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entryPath === fileURLToPath(import.meta.url)) {
  const files = await exportCsvFiles();
  console.log(`已生成 ${files.length} 份多维表格 CSV：${OUTPUT_DIR}`);
}
