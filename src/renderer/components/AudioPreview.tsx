import { useRef, useState } from 'react'
import { Waveform } from './Waveform'

/**
 * An audio player tile: a waveform with a play/pause toggle and a progress playhead.
 * Click-to-seek on the waveform. Used for audio assets in the library (and anywhere a
 * compact audio preview is needed). Stops propagation so it works inside draggable tiles.
 */
export function AudioPreview({
  src,
  waveformUrl,
  className,
}: {
  src: string
  /** Peaks JSON URL for the waveform, or null while none exists yet. */
  waveformUrl: string | null
  className?: string
}): React.JSX.Element {
  const ref = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  const toggle = (e: React.MouseEvent): void => {
    e.stopPropagation()
    e.preventDefault()
    const a = ref.current
    if (!a) return
    if (a.paused) void a.play()
    else a.pause()
  }
  const seek = (fraction: number): void => {
    const a = ref.current
    if (a && a.duration > 0) a.currentTime = fraction * a.duration
  }

  return (
    <div className={`relative flex items-center justify-center ${className ?? ''}`}>
      <Waveform
        url={waveformUrl}
        progress={progress}
        onSeek={seek}
        className="h-1/2 w-full px-2 text-emerald-400"
      />
      <audio
        ref={ref}
        src={src}
        className="hidden"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={() => {
          const a = ref.current
          if (a && a.duration > 0) setProgress(a.currentTime / a.duration)
        }}
      />
      <div
        role="button"
        tabIndex={-1}
        onClick={toggle}
        onPointerDown={(e) => e.stopPropagation()}
        title={playing ? 'Pause' : 'Play'}
        className="absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/60 text-xs text-white hover:bg-black/80"
      >
        {playing ? '⏸' : '▶'}
      </div>
    </div>
  )
}
