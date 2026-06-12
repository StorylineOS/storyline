import { useState } from 'react'
import { useFrameStore } from '../../store/frameStore'
import { LibraryPanel } from '../Library/LibraryPanel'

type Tab = 'assets' | 'gallery'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'assets', label: 'Assets', icon: '▦' },
  { key: 'gallery', label: 'Gallery', icon: '☰' },
]

/**
 * Collapsible left rail for the canvas. Assets reuses the full library (browse /
 * import / folders; drag a tile onto the canvas to create a frame). Gallery places
 * an existing frame. Node creation lives in the floating canvas toolbar instead.
 */
export function SideMenu({
  onAddFrame,
}: {
  onAddFrame: (frameId: string) => void
}): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('assets')
  const [open, setOpen] = useState(true)
  const frames = useFrameStore((s) => s.frames)

  if (!open) {
    return (
      <div className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-border bg-panel py-2">
        <button
          onClick={() => setOpen(true)}
          title="Expand menu"
          className="mb-1 text-zinc-400 hover:text-white"
        >
          ▸
        </button>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key)
              setOpen(true)
            }}
            title={t.label}
            className={`flex h-9 w-9 items-center justify-center rounded text-base ${
              tab === t.key ? 'bg-accent text-white' : 'text-zinc-400 hover:bg-surface'
            }`}
          >
            {t.icon}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex w-64 shrink-0 flex-col border-r border-border bg-panel">
      <div className="flex items-center justify-between border-b border-border px-1 py-1">
        <div className="flex gap-0.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              title={t.label}
              className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] ${
                tab === t.key ? 'bg-accent text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setOpen(false)}
          title="Collapse menu"
          className="px-1 text-zinc-500 hover:text-white"
        >
          ◂
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {/* Assets reuses the full library panel — same browse/import/folder UX as
            before; drag a tile onto the canvas to create a frame from it. */}
        {tab === 'assets' && <LibraryPanel />}

        {tab === 'gallery' && (
          <div className="overflow-y-auto p-2">
            {frames.length === 0 ? (
              <p className="text-xs text-zinc-600">
                No frames yet — drag an asset onto the canvas.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {frames.map((sh) => (
                  <button
                    key={sh.id}
                    onClick={() => onAddFrame(sh.id)}
                    title="Place this frame on the canvas"
                    className="rounded border border-border px-2 py-1 text-left text-xs text-zinc-300 hover:border-accent"
                  >
                    Frame {sh.name}
                    {sh.comfyWorkflowName ? ' 🔗' : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
