import { describe, it, expect } from 'vitest'
import {
  buildComposeArgs,
  timelineDuration,
  type ResolvedClip,
  type ComposeSettings,
} from './compose'

const SETTINGS: ComposeSettings = {
  width: 1920,
  height: 1080,
  fps: 30,
  preset: 'veryfast',
  crf: 20,
  outPath: '/out/timeline.mp4',
}

const videoClip = (over: Partial<ResolvedClip> = {}): ResolvedClip => ({
  kind: 'video',
  absPath: '/p/a.mp4',
  track: 0,
  startTime: 0,
  inPoint: 0,
  outPoint: 4,
  ...over,
})

describe('timelineDuration', () => {
  it('is the furthest clip end', () => {
    const clips = [
      videoClip({ startTime: 0, outPoint: 4 }),
      videoClip({ startTime: 5, outPoint: 3 }),
    ]
    expect(timelineDuration(clips)).toBeCloseTo(8) // 5 + 3
  })
})

describe('buildComposeArgs', () => {
  it('throws on an empty timeline', () => {
    expect(() => buildComposeArgs([], SETTINGS)).toThrow()
  })

  it('lays down base black video + silent audio beds before the clips', () => {
    const args = buildComposeArgs([videoClip()], SETTINGS)
    expect(args).toContain('color=c=black:s=1920x1080:r=30')
    expect(args).toContain('anullsrc=channel_layout=stereo:sample_rate=44100')
    expect(args[args.length - 1]).toBe('/out/timeline.mp4')
  })

  it('overlays a single video clip during its window and maps the overlay output', () => {
    const args = buildComposeArgs([videoClip({ startTime: 2, inPoint: 1, outPoint: 5 })], SETTINGS)
    const fc = args[args.indexOf('-filter_complex') + 1]
    expect(fc).toContain('scale=1920:1080:force_original_aspect_ratio=decrease')
    expect(fc).toContain("overlay=enable='between(t,2.000,6.000)'") // start 2, end 2+(5-1)=6
    // No audio clips → map the base silent bed directly.
    expect(args.join(' ')).toContain('-map 1:a')
    expect(args.join(' ')).toContain('-map [ov0]')
  })

  it('loops a still image for its duration', () => {
    const args = buildComposeArgs(
      [videoClip({ kind: 'image', absPath: '/p/s.png', outPoint: 3 })],
      SETTINGS,
    )
    // The image input is loaded with -loop 1 -t <dur> -i <path>.
    const i = args.indexOf('/p/s.png')
    expect(args.slice(i - 5, i)).toEqual(['-loop', '1', '-t', '3.000', '-i'])
  })

  it("includes an unmuted video clip's own audio when the source has an audio stream", () => {
    const args = buildComposeArgs(
      [videoClip({ startTime: 1, outPoint: 4, hasAudio: true, muted: false })],
      SETTINGS,
    )
    const fc = args[args.indexOf('-filter_complex') + 1]
    expect(fc).toContain('[2:a]atrim') // the video input's audio is brought into the mix
    expect(fc).toContain('amix=inputs=2:normalize=0')
    expect(args.join(' ')).toContain('-map [aout]')
  })

  it("drops a muted video clip's audio (maps the silent bed)", () => {
    const args = buildComposeArgs([videoClip({ hasAudio: true, muted: true })], SETTINGS)
    expect(args.join(' ')).toContain('-map 1:a')
    expect(args.join(' ')).not.toContain('amix')
  })

  it("drops a video clip's audio when the source has no audio stream", () => {
    const args = buildComposeArgs([videoClip({ hasAudio: false, muted: false })], SETTINGS)
    expect(args.join(' ')).toContain('-map 1:a')
    expect(args.join(' ')).not.toContain('amix')
  })

  it('renders an audio-only timeline over the black base (no video clips)', () => {
    const args = buildComposeArgs(
      [{ kind: 'audio', absPath: '/p/m.mp3', track: 1, startTime: 0, inPoint: 0, outPoint: 5 }],
      SETTINGS,
    )
    const joined = args.join(' ')
    expect(joined).toContain('color=c=black') // black video bed
    expect(joined).toContain('-map 0:v') // mapped directly (no video clips to overlay)
    expect(joined).toContain('-map [aout]') // the mixed audio
  })

  it('applies a layer volume filter to a clip audio chain', () => {
    const args = buildComposeArgs(
      [videoClip({ hasAudio: true, muted: false, volume: 0.5 })],
      SETTINGS,
    )
    const fc = args[args.indexOf('-filter_complex') + 1]
    expect(fc).toContain('volume=0.50')
  })

  it('drops a zero-volume layer from the mix (maps the silent bed)', () => {
    const args = buildComposeArgs(
      [
        {
          kind: 'audio',
          absPath: '/p/m.mp3',
          track: 1,
          startTime: 0,
          inPoint: 0,
          outPoint: 5,
          volume: 0,
        },
      ],
      SETTINGS,
    )
    expect(args.join(' ')).toContain('-map 1:a')
    expect(args.join(' ')).not.toContain('amix')
  })

  it('trims, delays, and mixes audio-track clips over the silent bed', () => {
    const clips: ResolvedClip[] = [
      videoClip({ startTime: 0, outPoint: 6 }),
      { kind: 'audio', absPath: '/p/m.mp3', track: 1, startTime: 1, inPoint: 0, outPoint: 5 },
    ]
    const args = buildComposeArgs(clips, SETTINGS)
    const fc = args[args.indexOf('-filter_complex') + 1]
    expect(fc).toContain('adelay=1000|1000') // start 1s → 1000ms
    expect(fc).toContain('amix=inputs=2:normalize=0')
    expect(args.join(' ')).toContain('-map [aout]')
  })
})
