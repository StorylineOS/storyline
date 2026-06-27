/**
 * The ffmpeg engine (CLAUDE.md engine-isolation rule: all ffmpeg lives here). Used
 * to make imported video usable in a Chromium UI that only decodes a few codecs:
 *  - a poster JPEG (first frame) so a video always shows *something*, any codec;
 *  - a probe of codec + pixel format to decide if Chromium can play it natively;
 *  - a transcode to H.264 (yuv420p) for the ones it can't.
 */
import ffmpegStatic from 'ffmpeg-static'
import { execFile, spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { computePeaks, type PeaksData } from './peaks'

// In a packaged app the binary is unpacked next to the asar (see electron-builder.yml).
const FFMPEG = (ffmpegStatic ?? '').replace('app.asar', 'app.asar.unpacked')

export const ffmpegAvailable = (): boolean => FFMPEG !== ''

/** Run ffmpeg; resolve its exit code + stderr (ffmpeg writes all info to stderr). */
function run(args: string[], timeoutMs: number): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    if (!FFMPEG) return resolve({ code: -1, stderr: 'ffmpeg binary not found' })
    execFile(FFMPEG, args, { timeout: timeoutMs, maxBuffer: 1 << 24 }, (err, _stdout, stderr) => {
      const code = err ? (typeof err.code === 'number' ? err.code : 1) : 0
      resolve({ code, stderr: stderr ?? '' })
    })
  })
}

/** Extract a downscaled first-frame poster JPEG. Returns true on success. */
export async function generatePoster(srcAbs: string, outAbs: string): Promise<boolean> {
  const { code } = await run(
    ['-y', '-i', srcAbs, '-frames:v', '1', '-vf', 'scale=640:-2', outAbs],
    60_000,
  )
  return code === 0 && existsSync(outAbs)
}

/**
 * Write a downscaled JPEG thumbnail of an image so nodes/grid cells don't decode the
 * full-resolution original. Caps width at 640px (never upscales) and keeps aspect.
 * Transparency is dropped (JPEG has no alpha). Returns true on success.
 */
export async function generateImageThumb(srcAbs: string, outAbs: string): Promise<boolean> {
  const { code } = await run(
    ['-y', '-i', srcAbs, '-frames:v', '1', '-vf', "scale='min(640,iw)':-2", outAbs],
    60_000,
  )
  return code === 0 && existsSync(outAbs)
}

/**
 * Render a horizontal filmstrip PNG: `frames` evenly-spaced thumbnails tiled in one row,
 * for the director timeline's video clips. Returns true on success.
 */
export async function generateFilmstrip(
  srcAbs: string,
  outAbs: string,
  frames: number,
  durationSec: number,
): Promise<boolean> {
  if (durationSec <= 0 || frames < 1) return false
  // Sample `frames` frames across the clip, scale each to 160px wide, tile in a single row.
  const fps = frames / durationSec
  const { code } = await run(
    [
      '-y',
      '-i',
      srcAbs,
      '-frames:v',
      '1',
      '-vf',
      `fps=${fps.toFixed(4)},scale=160:-2,tile=${frames}x1`,
      outAbs,
    ],
    120_000,
  )
  return code === 0 && existsSync(outAbs)
}

/** Read the first video stream's codec + pixel format (null if it can't be read). */
export async function probeVideo(
  srcAbs: string,
): Promise<{ codec: string; pixFmt: string } | null> {
  // `ffmpeg -i <file>` with no output exits non-zero but prints stream info to stderr.
  const { stderr } = await run(['-i', srcAbs], 30_000)
  const line = stderr.split('\n').find((l) => l.includes('Video:'))
  if (!line) return null
  const codec = (/Video:\s*([a-zA-Z0-9_]+)/.exec(line)?.[1] ?? '').toLowerCase()
  const pixFmt = (
    /,\s*(yuv[a-z0-9]+|gbr[a-z0-9]*|rgb[a-z0-9]*|bgr[a-z0-9]*|gray[a-z0-9]*|nv[0-9]+|p0[0-9]+[a-z]*)/i.exec(
      line,
    )?.[1] ?? ''
  ).toLowerCase()
  return { codec, pixFmt }
}

/** Whether a media file has at least one audio stream (probed via ffmpeg's stream dump). */
export async function hasAudioStream(srcAbs: string): Promise<boolean> {
  const { stderr } = await run(['-i', srcAbs], 30_000)
  return stderr.split('\n').some((l) => l.includes('Audio:'))
}

/** Probe a media file's duration (seconds) and whether it has an audio stream. */
export async function probeMedia(
  srcAbs: string,
): Promise<{ durationSec: number; hasAudio: boolean }> {
  const { stderr } = await run(['-i', srcAbs], 30_000)
  const hasAudio = stderr.split('\n').some((l) => l.includes('Audio:'))
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr)
  const durationSec = m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0
  return { durationSec, hasAudio }
}

/** Whether Chromium's bundled media stack can decode this codec + pixel format. */
export function isWebPlayable(codec: string, pixFmt: string): boolean {
  if (codec === 'vp8' || codec === 'vp9' || codec === 'av1') return true
  if (codec === 'h264') return pixFmt === '' || pixFmt === 'yuv420p' || pixFmt === 'yuvj420p'
  return false
}

// Low sample rate is plenty for a waveform preview and keeps the PCM small.
const PEAKS_SAMPLE_RATE = 8000

/**
 * Decode an audio file to mono PCM and write a waveform peaks JSON to `outAbs`.
 * Returns true on success. Uses a temp `.pcm` sidecar so long files don't blow the
 * execFile stdout buffer.
 */
export async function generatePeaks(
  srcAbs: string,
  outAbs: string,
  buckets = 1000,
): Promise<boolean> {
  const pcmPath = `${outAbs}.pcm`
  const { code } = await run(
    ['-y', '-i', srcAbs, '-f', 's16le', '-ac', '1', '-ar', String(PEAKS_SAMPLE_RATE), pcmPath],
    120_000,
  )
  if (code !== 0 || !existsSync(pcmPath)) return false
  try {
    const buf = readFileSync(pcmPath)
    const count = Math.floor(buf.byteLength / 2)
    // Copy into a fresh, 2-byte-aligned ArrayBuffer (a Node Buffer's byteOffset may be
    // odd/unaligned, which would make the Int16Array constructor throw).
    const aligned = buf.buffer.slice(buf.byteOffset, buf.byteOffset + count * 2)
    const samples = new Int16Array(aligned)
    const data: PeaksData = computePeaks(samples, PEAKS_SAMPLE_RATE, buckets)
    writeFileSync(outAbs, JSON.stringify(data))
    return true
  } catch {
    return false
  } finally {
    try {
      rmSync(pcmPath, { force: true })
    } catch {
      // ignore
    }
  }
}

/** Parse ffmpeg's `time=HH:MM:SS.xx` progress line into seconds (null if absent). */
function parseProgressSeconds(line: string): number | null {
  const m = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(line)
  if (!m) return null
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
}

export interface ComposeHandle {
  /** Resolves true on success (exit 0 and output exists). */
  done: Promise<boolean>
  /** Abort the render. */
  cancel: () => void
}

/**
 * Run a long compose/render with progress + cancellation. `args` is a full ffmpeg arg
 * vector (see export/compose.ts); `totalSeconds` scales the 0..1 progress. The output
 * path is the last arg. Returns immediately with a handle.
 */
export function composeRender(
  args: string[],
  totalSeconds: number,
  onProgress?: (fraction: number) => void,
): ComposeHandle {
  const outPath = args[args.length - 1]
  if (!FFMPEG) return { done: Promise.resolve(false), cancel: () => {} }
  const child = spawn(FFMPEG, args, { windowsHide: true })
  child.stderr.on('data', (buf: Buffer) => {
    if (!onProgress || totalSeconds <= 0) return
    const secs = parseProgressSeconds(buf.toString())
    if (secs !== null) onProgress(Math.min(1, secs / totalSeconds))
  })
  const done = new Promise<boolean>((resolve) => {
    child.on('error', () => resolve(false))
    child.on('close', (code) => resolve(code === 0 && existsSync(outPath)))
  })
  return { done, cancel: () => child.kill('SIGKILL') }
}

/** Transcode to a Chromium-friendly H.264 MP4 (8-bit, even dimensions). True on success. */
export async function transcodeH264(srcAbs: string, outAbs: string): Promise<boolean> {
  const { code } = await run(
    [
      '-y',
      '-i',
      srcAbs,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      // libx264 + yuv420p needs even dimensions.
      '-vf',
      'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
      outAbs,
    ],
    600_000,
  )
  return code === 0 && existsSync(outAbs)
}
