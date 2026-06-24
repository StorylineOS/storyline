import { describe, it, expect } from 'vitest'
import { computePeaks } from './peaks'

describe('computePeaks', () => {
  it('returns an empty waveform for empty PCM', () => {
    const out = computePeaks(new Int16Array(0), 8000)
    expect(out).toEqual({ version: 1, duration: 0, peaks: [] })
  })

  it('derives duration from sample count and rate', () => {
    const out = computePeaks(new Int16Array(8000), 8000)
    expect(out.duration).toBe(1)
  })

  it('buckets to at most `buckets` max-abs amplitudes, normalised to 0..1', () => {
    // 10 samples, 5 buckets → size 2; each bucket is the louder of its pair.
    const pcm = Int16Array.from([0, 16384, -32768, 100, 8192, 8192, 0, 0, -16384, 1])
    const out = computePeaks(pcm, 10, 5)
    expect(out.peaks).toHaveLength(5)
    expect(out.peaks[0]).toBeCloseTo(16384 / 32768) // max(0, 16384)
    expect(out.peaks[1]).toBeCloseTo(32768 / 32768) // max(|-32768|, 100) → clamped to 1
    expect(out.peaks[1]).toBeLessThanOrEqual(1)
    expect(out.peaks[2]).toBeCloseTo(8192 / 32768)
    expect(out.peaks[3]).toBe(0)
    expect(out.peaks[4]).toBeCloseTo(16384 / 32768)
  })

  it('never emits more buckets than requested', () => {
    const out = computePeaks(new Int16Array(1000).fill(1000), 8000, 50)
    expect(out.peaks.length).toBeLessThanOrEqual(50)
  })
})
