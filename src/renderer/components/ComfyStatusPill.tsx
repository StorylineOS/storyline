import { useComfyStatusStore } from '../store/comfyStatusStore'

/**
 * Plain-language ComfyUI connection indicator: a green dot reads "ComfyUI connected", a
 * grey dot reads "ComfyUI not connected". Reads the app-wide status store so it stays live.
 */
export function ComfyStatusPill(): React.JSX.Element {
  const running = useComfyStatusStore((s) => s.running)
  const connected = running === true
  const label = connected ? 'ComfyUI connected' : 'ComfyUI not connected'
  const dot = connected ? 'bg-green-500' : running === false ? 'bg-zinc-500' : 'bg-zinc-600'

  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
      <span className="text-xs text-zinc-300">{label}</span>
    </span>
  )
}
