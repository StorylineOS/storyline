import { useEffect, useState } from 'react'
import { useSettingsStore } from '../store/settingsStore'

/**
 * The ComfyUI URL input + Save control, bound to the app settings store. Saving persists
 * to settings; the app-wide reachability poll picks up the new URL on its next tick.
 */
export function ComfyUrlField({ className = '' }: { className?: string }): React.JSX.Element {
  const comfyUrl = useSettingsStore((s) => s.comfyUrl)
  const setComfyUrl = useSettingsStore((s) => s.setComfyUrl)
  const [draft, setDraft] = useState(comfyUrl)

  // Keep the field in sync when the stored URL loads/changes.
  useEffect(() => setDraft(comfyUrl), [comfyUrl])

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void setComfyUrl(draft)
        }}
        spellCheck={false}
        placeholder="http://127.0.0.1:8188"
        className="min-w-0 flex-1 rounded border border-border bg-panel px-2 py-1 text-xs text-zinc-200 outline-none placeholder:text-zinc-500 focus:border-accent"
      />
      <button
        onClick={() => void setComfyUrl(draft)}
        className="shrink-0 rounded border border-border px-2 py-1 text-xs text-zinc-300 hover:bg-surface"
      >
        Save
      </button>
    </div>
  )
}
