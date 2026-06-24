/**
 * Waveform peaks: a compact amplitude summary of an audio file, drawn as a bar chart
 * in the UI. The ffmpeg decode lives in ffmpeg.ts; the bucketing here is pure (no I/O)
 * so it can be unit-tested directly.
 */

export interface PeaksData {
  version: 1
  /** Duration of the source audio in seconds. */
  duration: number
  /** Per-bucket peak amplitude, normalised to 0..1. */
  peaks: number[]
}

/**
 * Reduce signed 16-bit mono PCM to at most `buckets` max-abs amplitudes (0..1). Each
 * bucket is the loudest sample in its slice — what a waveform bar should reach.
 */
export function computePeaks(pcm: Int16Array, sampleRate: number, buckets = 1000): PeaksData {
  const total = pcm.length
  const duration = sampleRate > 0 ? total / sampleRate : 0
  if (total === 0 || buckets <= 0) return { version: 1, duration, peaks: [] }

  const size = Math.ceil(total / buckets)
  const out: number[] = []
  for (let i = 0; i < total; i += size) {
    const end = Math.min(i + size, total)
    let max = 0
    for (let j = i; j < end; j++) {
      const v = Math.abs(pcm[j])
      if (v > max) max = v
    }
    // 32768 = |min Int16|; clamp to 1 in the unlikely max-negative case.
    out.push(Math.min(1, max / 32768))
  }
  return { version: 1, duration, peaks: out }
}
