import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createOneKosRuntime } from '../src/api-router.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try { process.loadEnvFile(path.join(ROOT, '.env')); } catch {}

const useLocalGenerator = process.argv.includes('--local');
const runtime = createOneKosRuntime({
  env: useLocalGenerator
    ? { ...process.env, LLM_BASE_URL: '', LLM_API_KEY: '', LLM_MODEL: '' }
    : process.env,
});
const contentId = process.argv.slice(2).find((argument) => !argument.startsWith('--')) || 'CONTENT-VIDEO-DEMO-20260809';
const result = await runtime.service.runProductionDemo({
  advisorId: 'ADV-017',
  taskId: 'TASK-001',
  contentId,
});

await mkdir(path.join(ROOT, 'output'), { recursive: true });
const outputPath = path.join(ROOT, 'output', `${contentId}.json`);
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  mode: result.mode,
  generator: result.generator,
  contentId: result.content.contentId,
  title: result.content.title,
  schemaVersion: result.content.schemaVersion,
  shotCount: result.content.shots.length,
  requiredAssetCount: result.comparison.requiredCount,
  matchedAssetCount: result.comparison.matchedCount,
  assetsComplete: result.comparison.complete,
  qualityPassed: result.quality.passed,
  contentWrite: result.write.action,
  requirementWrites: result.requirementWrites.length,
  assetWrites: result.assetWrites.length,
  editingJobId: result.editingJob?.editingJobId || null,
  editingJobStatus: result.editingJob?.status || null,
  outputPath,
  simulationNotice: result.simulationNotice,
}, null, 2));
