/**
 * Builds the ffmpeg argument list to render a director node's timeline (EDL) into a
 * single muxed MP4. Pure + deterministic given resolved clip paths, so it's unit-tested
 * directly; the actual ffmpeg spawn lives in media/ffmpeg.ts (engine isolation).
 *
 * Model: clips reference absolute files, positioned at `startTime` and trimmed to
 * in/out (seconds). Track 0 = video (images get a synthetic duration via -loop), track
 * 1 = audio. Heterogeneous sources are normalised to a common W×H/fps and 44.1k stereo
 * before being overlaid / mixed onto a base black-video + silent-audio bed.
 */

export type ClipKind = 'video' | 'image' | 'audio'

export interface ResolvedClip {
  kind: ClipKind
  /** Absolute path to the source media. */
  absPath: string
  /** 0 = video track, 1 = audio track. */
  track: number
  startTime: number
  inPoint: number
  outPoint: number
  /** Mute this clip's own embedded audio (video-track video clips). */
  muted?: boolean
  /** Whether the source actually has an audio stream (probed; avoids mapping a missing stream). */
  hasAudio?: boolean
  /** Layer gain applied to this clip's audio (0..1); default 1. A 0 drops it from the mix. */
  volume?: number
}

const clipVolume = (c: ResolvedClip): number => (typeof c.volume === 'number' ? c.volume : 1)

/**
 * Whether a clip contributes audio to the mix: any audio-track clip, or a video-track
 * video clip that has audio and isn't muted — and in both cases only when its volume > 0.
 */
function contributesAudio(c: ResolvedClip): boolean {
  if (clipVolume(c) <= 0) return false
  if (c.track === 1) return true
  return c.kind === 'video' && !c.muted && c.hasAudio === true
}

export interface ComposeSettings {
  width: number
  height: number
  fps: number
  /** x264 preset (e.g. 'veryfast' full, 'ultrafast' proxy). */
  preset: string
  /** x264 CRF (lower = better; ~23 full, ~30 proxy). */
  crf: number
  outPath: string
}

const clipDuration = (c: ResolvedClip): number => Math.max(0.04, c.outPoint - c.inPoint)
const clipEnd = (c: ResolvedClip): number => c.startTime + clipDuration(c)

/** Total timeline length = the furthest clip end (min 0.04s). */
export function timelineDuration(clips: ResolvedClip[]): number {
  return clips.reduce((max, c) => Math.max(max, clipEnd(c)), 0.04)
}

/**
 * Produce the full ffmpeg arg vector (excluding the binary). Throws if there are no
 * clips. Input order: [0] base black video, [1] base silent audio, then one input per
 * clip in array order.
 */
export function buildComposeArgs(clips: ResolvedClip[], s: ComposeSettings): string[] {
  if (clips.length === 0) throw new Error('Cannot compose an empty timeline.')
  const total = timelineDuration(clips)
  const totalStr = total.toFixed(3)

  const args: string[] = ['-y']

  // Base beds: a black video and silent audio spanning the whole timeline.
  args.push(
    '-f',
    'lavfi',
    '-t',
    totalStr,
    '-i',
    `color=c=black:s=${s.width}x${s.height}:r=${s.fps}`,
  )
  args.push('-f', 'lavfi', '-t', totalStr, '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100')

  // One input per clip (index starts at 2). Images loop for their duration.
  clips.forEach((c) => {
    const dur = clipDuration(c).toFixed(3)
    if (c.kind === 'image') {
      args.push('-loop', '1', '-t', dur, '-i', c.absPath)
    } else {
      args.push('-ss', c.inPoint.toFixed(3), '-t', dur, '-i', c.absPath)
    }
  })

  const filters: string[] = []
  // Video overlays: start from the base, overlay each video/image clip during its window.
  let videoLabel = '0:v'
  let aIdx = 0
  clips.forEach((c, i) => {
    const input = i + 2
    if (c.track === 0 && (c.kind === 'video' || c.kind === 'image')) {
      const v = `v${i}`
      filters.push(
        `[${input}:v]scale=${s.width}:${s.height}:force_original_aspect_ratio=decrease,` +
          `pad=${s.width}:${s.height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${s.fps},` +
          `setpts=PTS-STARTPTS+${c.startTime.toFixed(3)}/TB[${v}]`,
      )
      const out = `ov${i}`
      filters.push(
        `[${videoLabel}][${v}]overlay=enable='between(t,${c.startTime.toFixed(3)},${clipEnd(c).toFixed(3)})'[${out}]`,
      )
      videoLabel = out
    }
  })

  // Audio: trim/normalise/delay each contributing clip (audio-track clips, plus unmuted
  // video clips' own audio), then mix over the silent bed.
  const audioLabels: string[] = ['1:a']
  clips.forEach((c, i) => {
    const input = i + 2
    if (contributesAudio(c)) {
      const ms = Math.round(c.startTime * 1000)
      const dur = clipDuration(c)
      // A short fade in/out de-clicks the hard cut where one clip hands off to the next
      // (otherwise the waveform discontinuity at the boundary is audible).
      const fade = Math.min(0.02, dur / 4)
      const fadeOutAt = Math.max(0, dur - fade).toFixed(3)
      const a = `a${aIdx++}`
      filters.push(
        `[${input}:a]atrim=0:${dur.toFixed(3)},asetpts=PTS-STARTPTS,` +
          `aformat=sample_rates=44100:channel_layouts=stereo,` +
          `volume=${clipVolume(c).toFixed(2)},` +
          `afade=t=in:st=0:d=${fade.toFixed(3)},afade=t=out:st=${fadeOutAt}:d=${fade.toFixed(3)},` +
          `adelay=${ms}|${ms}[${a}]`,
      )
      audioLabels.push(a)
    }
  })

  let audioOut = '1:a'
  if (audioLabels.length > 1) {
    audioOut = 'aout'
    filters.push(
      `${audioLabels.map((l) => `[${l}]`).join('')}amix=inputs=${audioLabels.length}:normalize=0:dropout_transition=0[${audioOut}]`,
    )
  }

  if (filters.length > 0) args.push('-filter_complex', filters.join(';'))
  // A bare input stream (e.g. "0:v") maps without brackets; a filter label needs them.
  args.push('-map', videoLabel === '0:v' ? '0:v' : `[${videoLabel}]`)
  args.push('-map', audioOut === '1:a' ? '1:a' : `[${audioOut}]`)

  args.push(
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-preset',
    s.preset,
    '-crf',
    String(s.crf),
    '-c:a',
    'aac',
    '-movflags',
    '+faststart',
    '-r',
    String(s.fps),
    '-t',
    totalStr,
    s.outPath,
  )
  return args
}
