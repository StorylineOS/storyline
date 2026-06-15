/**
 * The ffmpeg engine (CLAUDE.md engine-isolation rule: all ffmpeg lives here). Used
 * to make imported video usable in a Chromium UI that only decodes a few codecs:
 *  - a poster JPEG (first frame) so a video always shows *something*, any codec;
 *  - a probe of codec + pixel format to decide if Chromium can play it natively;
 *  - a transcode to H.264 (yuv420p) for the ones it can't.
 */
import ffmpegStatic from 'ffmpeg-static'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'

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

/** Whether Chromium's bundled media stack can decode this codec + pixel format. */
export function isWebPlayable(codec: string, pixFmt: string): boolean {
  if (codec === 'vp8' || codec === 'vp9' || codec === 'av1') return true
  if (codec === 'h264') return pixFmt === '' || pixFmt === 'yuv420p' || pixFmt === 'yuvj420p'
  return false
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
