import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MAX_FEISHU_MEDIA_BYTES = 20 * 1024 * 1024;

function safeName(value, fallback = 'item') {
  const normalized = String(value || '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function extensionFor(asset) {
  const fromName = path.extname(String(asset.fileName || '')).toLowerCase();
  if (/^\.[a-z0-9]{1,8}$/.test(fromName)) return fromName;
  const type = String(asset.mimeType || '');
  if (type.includes('quicktime')) return '.mov';
  if (type.includes('webm')) return '.webm';
  if (type.startsWith('image/png')) return '.png';
  if (type.startsWith('image/')) return '.jpg';
  if (type.startsWith('audio/mpeg')) return '.mp3';
  if (type.startsWith('audio/')) return '.m4a';
  return '.mp4';
}

function seconds(value, fallback = 5) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 300) : fallback;
}

function srtTime(value) {
  const totalMs = Math.max(0, Math.round(Number(value || 0) * 1000));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const millis = totalMs % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

function escapeSrt(value) {
  return String(value || '').replace(/\r/g, '').trim();
}

function run(executable, args, { cwd, timeoutMs = 10 * 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, shell: false, windowsHide: true });
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`视频处理超时（${Math.round(timeoutMs / 1000)} 秒）`));
    }, timeoutMs);
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk.toString()}`.slice(-12_000);
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(new Error(`无法启动 ${path.basename(executable)}：${error.message}`));
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stderr });
      else reject(new Error(`${path.basename(executable)} 执行失败（退出码 ${code}）：${stderr.trim().slice(-2_000)}`));
    });
  });
}

export class LocalFfmpegVideoEditor {
  constructor({
    ffmpegPath = 'ffmpeg', ffprobePath = 'ffprobe', workDir = path.resolve('output', 'video-jobs'),
    width = 720, height = 1280, fps = 30,
    fontDir = process.platform === 'win32' ? 'C:/Windows/Fonts' : '',
    fontName = process.platform === 'win32' ? 'Microsoft YaHei' : 'Noto Sans CJK SC',
  } = {}) {
    this.ffmpegPath = ffmpegPath;
    this.ffprobePath = ffprobePath;
    this.workDir = path.resolve(workDir);
    this.width = width;
    this.height = height;
    this.fps = fps;
    this.fontDir = fontDir;
    this.fontName = fontName;
  }

  async checkAvailability() {
    await run(this.ffmpegPath, ['-version'], { timeoutMs: 15_000 });
    await run(this.ffprobePath, ['-version'], { timeoutMs: 15_000 });
    return { available: true, ffmpegPath: this.ffmpegPath, ffprobePath: this.ffprobePath };
  }

  outputPathFor(job) {
    const jobDir = path.join(this.workDir, safeName(job.editingJobId, 'render-job'));
    return path.join(jobDir, `${safeName(job.contentId, 'content')}-preview.mp4`);
  }

  async readOutput(job) {
    return new Uint8Array(await readFile(this.outputPathFor(job)));
  }

  async probe(filePath) {
    const output = await new Promise((resolve, reject) => {
      const child = spawn(this.ffprobePath, ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height,duration', '-of', 'json', filePath], { shell: false, windowsHide: true });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
      child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      child.once('error', (error) => reject(new Error(`无法启动 ffprobe：${error.message}`)));
      child.once('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(`ffprobe 检查失败：${stderr.trim()}`)));
    });
    const data = JSON.parse(output);
    const video = data.streams?.find((stream) => stream.codec_type === 'video');
    const audio = data.streams?.find((stream) => stream.codec_type === 'audio');
    return {
      durationSec: Number(data.format?.duration || video?.duration || audio?.duration) || 0,
      width: Number(video?.width) || 0,
      height: Number(video?.height) || 0,
      hasVideo: Boolean(video),
      hasAudio: Boolean(audio),
      videoCodec: video?.codec_name || null,
      audioCodec: audio?.codec_name || null,
    };
  }

  async inspectBytes({ bytes, fileName, mimeType, type = 'video' }) {
    if (type === 'text') return { durationSec: 0, width: 0, height: 0, hasVideo: false, hasAudio: false };
    const inspectionDir = path.join(this.workDir, 'inspections');
    await mkdir(inspectionDir, { recursive: true });
    const filePath = path.join(inspectionDir, `${randomUUID()}${extensionFor({ fileName, mimeType })}`);
    await writeFile(filePath, bytes);
    try {
      return await this.probe(filePath);
    } finally {
      await unlink(filePath).catch(() => {});
    }
  }

  videoFilter() {
    return `scale=${this.width}:${this.height}:force_original_aspect_ratio=decrease,pad=${this.width}:${this.height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=${this.fps}`;
  }

  encodeArgs() {
    const keyframeInterval = Math.max(1, this.fps * 2);
    return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-maxrate', '1500k', '-bufsize', '3000k', '-pix_fmt', 'yuv420p', '-r', String(this.fps), '-g', String(keyframeInterval), '-keyint_min', String(keyframeInterval), '-sc_threshold', '0', '-c:a', 'aac', '-b:a', '96k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart'];
  }

  async validateOutput(filePath) {
    const metadata = await this.probe(filePath);
    if (!metadata.hasVideo || metadata.videoCodec !== 'h264') throw new Error('预览成片缺少可播放的 H.264 视频流');
    if (!metadata.durationSec) throw new Error('预览成片时长无效');
    const nullOutput = process.platform === 'win32' ? 'NUL' : '/dev/null';
    await run(this.ffmpegPath, ['-hide_banner', '-v', 'error', '-i', filePath, '-map', '0:v:0', '-f', 'null', nullOutput]);
    return metadata;
  }

  async renderSegment({ asset, inputPath, outputPath, durationSec, metadata, cwd }) {
    const duration = seconds(Math.min(durationSec || Infinity, metadata.durationSec || Infinity), seconds(durationSec));
    const commonTail = [...this.encodeArgs(), '-t', String(duration), outputPath];
    if (asset.type === 'image') {
      await run(this.ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-loop', '1', '-i', inputPath, '-f', 'lavfi', '-t', String(duration), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000', '-map', '0:v:0', '-map', '1:a:0', '-vf', this.videoFilter(), ...commonTail], { cwd });
      return;
    }
    if (asset.type === 'audio') {
      await run(this.ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `color=c=0x202430:s=${this.width}x${this.height}:r=${this.fps}:d=${duration}`, '-i', inputPath, '-map', '0:v:0', '-map', '1:a:0', '-af', `apad=whole_dur=${duration}`, ...commonTail], { cwd });
      return;
    }
    if (asset.type === 'text') {
      await run(this.ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `color=c=0x202430:s=${this.width}x${this.height}:r=${this.fps}:d=${duration}`, '-f', 'lavfi', '-t', String(duration), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000', '-map', '0:v:0', '-map', '1:a:0', ...commonTail], { cwd });
      return;
    }
    const audioArgs = metadata.hasAudio
      ? ['-map', '0:v:0', '-map', '0:a:0', '-af', `aresample=async=1:first_pts=0,apad=whole_dur=${duration}`]
      : ['-f', 'lavfi', '-t', String(duration), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000', '-map', '0:v:0', '-map', '1:a:0'];
    await run(this.ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath, ...audioArgs, '-vf', this.videoFilter(), ...commonTail], { cwd });
  }

  async render({ job, assets, getAssetBytes, onProgress = async () => {} }) {
    const stableJobDir = path.join(this.workDir, safeName(job.editingJobId, 'render-job'));
    const jobDir = path.join(stableJobDir, `run-${randomUUID()}`);
    await mkdir(jobDir, { recursive: true });
    const assetMap = new Map(assets.map((asset) => [asset.assetId, asset]));
    const segments = [];
    const subtitleItems = [];
    let timelineSec = 0;
    const shots = job.editingPlan?.shots || [];
    for (let index = 0; index < shots.length; index += 1) {
      const shot = shots[index];
      const asset = (shot.assetIds || []).map((assetId) => assetMap.get(assetId)).find(Boolean);
      if (!asset?.fileToken) throw new Error(`镜头 ${shot.shotId} 缺少可下载素材`);
      const inputName = `input-${String(index + 1).padStart(3, '0')}-${safeName(asset.assetId)}${extensionFor(asset)}`;
      const inputPath = path.join(jobDir, inputName);
      await writeFile(inputPath, await getAssetBytes(asset));
      const metadata = asset.type === 'text'
        ? { durationSec: Number(shot.durationSec) || 5, width: 0, height: 0, hasVideo: false, hasAudio: false }
        : await this.probe(inputPath);
      const segmentName = `segment-${String(index + 1).padStart(3, '0')}.mp4`;
      const segmentPath = path.join(jobDir, segmentName);
      const durationSec = seconds(shot.durationSec, metadata.durationSec || 5);
      await this.renderSegment({ asset, inputPath, outputPath: segmentPath, durationSec, metadata, cwd: jobDir });
      segments.push(segmentName);
      if (escapeSrt(shot.scriptText)) subtitleItems.push({ start: timelineSec, end: timelineSec + durationSec, text: escapeSrt(shot.scriptText) });
      timelineSec += durationSec;
      await onProgress(Math.min(75, 20 + Math.round(((index + 1) / shots.length) * 55)), `正在处理镜头 ${index + 1}/${shots.length}`);
    }
    if (!segments.length) throw new Error('剪辑方案中没有可处理镜头');

    await writeFile(path.join(jobDir, 'concat.txt'), segments.map((name) => `file '${name}'`).join('\n'), 'utf8');
    await run(this.ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', 'joined.mp4'], { cwd: jobDir });

    const subtitleText = subtitleItems.map((item, index) => [String(index + 1), `${srtTime(item.start)} --> ${srtTime(item.end)}`, item.text, ''].join('\n')).join('\n');
    const outputPath = this.outputPathFor(job);
    const pendingOutputPath = path.join(jobDir, `${safeName(job.contentId, 'content')}-preview.pending.mp4`);
    const normalizedAudio = ['-af', 'aresample=async=1:first_pts=0'];
    if (subtitleText) {
      await writeFile(path.join(jobDir, 'subtitles.srt'), `\uFEFF${subtitleText}`, 'utf8');
      const fontDir = this.fontDir ? `:fontsdir='${String(this.fontDir).replace(/\\/g, '/').replace(':', '\\:')}'` : '';
      await run(this.ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-i', 'joined.mp4', '-vf', `setpts=PTS-STARTPTS,subtitles=subtitles.srt${fontDir}:force_style='FontName=${this.fontName},FontSize=16,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BorderStyle=3,Outline=1,Shadow=0,MarginV=55,Alignment=2'`, ...normalizedAudio, ...this.encodeArgs(), path.basename(pendingOutputPath)], { cwd: jobDir });
    } else {
      await run(this.ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-i', 'joined.mp4', '-vf', 'setpts=PTS-STARTPTS', ...normalizedAudio, ...this.encodeArgs(), path.basename(pendingOutputPath)], { cwd: jobDir });
    }
    await this.validateOutput(pendingOutputPath);
    await mkdir(stableJobDir, { recursive: true });
    await unlink(outputPath).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    await rename(pendingOutputPath, outputPath);
    const outputStat = await stat(outputPath);
    if (outputStat.size > MAX_FEISHU_MEDIA_BYTES) throw new Error(`成片大小 ${(outputStat.size / 1024 / 1024).toFixed(1)}MB，超过飞书单素材 20MB 限制，请缩短素材或降低码率`);
    await onProgress(85, '本地视频已生成，准备上传飞书');
    return { outputPath, fileName: path.basename(outputPath), mimeType: 'video/mp4', bytes: new Uint8Array(await readFile(outputPath)), size: outputStat.size, durationSec: timelineSec };
  }
}
