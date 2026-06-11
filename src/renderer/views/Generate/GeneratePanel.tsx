import { useEffect, useState } from 'react'
import type { ComfyStatus } from '@shared/types'
import { useSettingsStore } from '../../store/settingsStore'

/**
 * The Generate tab embeds ComfyUI in an iframe. It polls the backend; when it's not
 * reachable it shows guidance instead. The URL is editable (persisted to settings).
 * Per-shot "Send to ComfyUI" / "Pull result" actions live on the shot timeline.
 */
export function GeneratePanel(): React.JSX.Element {
  const { comfyUrl, load, setComfyUrl } = useSettingsStore()
  const [status, setStatus] = useState<ComfyStatus | null>(null)
  const [draftUrl, setDraftUrl] = useState('')

  const check = async (): Promise<void> => {
    try {
      const res = await window.storyline.comfy.status()
      if (res.ok) setStatus(res.value)
    } catch {
      setStatus({ running: false, url: comfyUrl })
    }
  }

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setDraftUrl(comfyUrl)
  }, [comfyUrl])

  useEffect(() => {
    void check()
    const timer = setInterval(() => void check(), 4000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comfyUrl])

  const running = status?.running ?? false
  const url = status?.url ?? comfyUrl

  return (
    <div className="flex h-full flex-col bg-panel">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span
          className={`h-2 w-2 rounded-full ${running ? 'bg-green-500' : 'bg-zinc-600'}`}
          title={running ? 'ComfyUI is running' : 'ComfyUI is not reachable'}
        />
        <span className="text-xs uppercase tracking-wide text-zinc-400">ComfyUI</span>
        <input
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void setComfyUrl(draftUrl)
          }}
          spellCheck={false}
          className="ml-2 w-72 rounded border border-border bg-surface px-2 py-1 text-xs text-zinc-200 outline-none focus:border-accent"
        />
        <button
          onClick={() => void setComfyUrl(draftUrl)}
          className="rounded border border-border px-2 py-1 text-xs text-zinc-300 hover:bg-surface"
        >
          Save
        </button>
        <button
          onClick={() => void check()}
          className="rounded border border-border px-2 py-1 text-xs text-zinc-300 hover:bg-surface"
        >
          Retry
        </button>
      </div>

      <div className="relative flex-1">
        {running ? (
          <iframe title="ComfyUI" src={url} className="h-full w-full border-0 bg-white" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm text-zinc-300">ComfyUI is not running</p>
            <p className="max-w-md text-xs text-zinc-500">
              Start ComfyUI and make sure it's reachable at{' '}
              <span className="text-zinc-300">{url}</span>. Update the URL above if it runs
              elsewhere, then press Retry.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
