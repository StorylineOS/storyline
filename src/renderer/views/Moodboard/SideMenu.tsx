import { useState } from 'react'
import { useShotStore } from '../../store/shotStore'
import { LibraryPanel } from '../Library/LibraryPanel'

type Tab = 'assets' | 'components' | 'gallery'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'assets', label: 'Assets', icon: '▦' },
  { key: 'components', label: 'Components', icon: '◳' },
  { key: 'gallery', label: 'Gallery', icon: '☰' },
]

/**
 * Collapsible left rail for the canvas. Assets reuses the full library (browse /
 * import / folders; drag a tile onto the canvas to create a shot). Components is the
 * node palette (Layer / Preview / Text). Gallery places an existing shot.
 */
export function SideMenu({
  onAddShot,
  onAddPreview,
  onAddText,
  onAddLayer,
}: {
  onAddShot: (shotId: string) => void
  onAddPreview: () => void
  onAddText: () => void
  onAddLayer: () => void
}): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('assets')
  const [open, setOpen] = useState(true)
  const shots = useShotStore((s) => s.shots)

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
            before; drag a tile onto the canvas to create a shot from it. */}
        {tab === 'assets' && <LibraryPanel />}

        {tab === 'components' && (
          <div className="flex flex-col gap-1.5 p-2">
            <p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-600">Add to canvas</p>
            <PaletteButton icon="▦" label="Layer group" onClick={onAddLayer} />
            <PaletteButton icon="▣" label="Preview node" onClick={onAddPreview} />
            <PaletteButton icon="T" label="Text" onClick={onAddText} />
          </div>
        )}

        {tab === 'gallery' && (
          <div className="overflow-y-auto p-2">
            {shots.length === 0 ? (
              <p className="text-xs text-zinc-600">No shots yet — drag an asset onto the canvas.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {shots.map((sh) => (
                  <button
                    key={sh.id}
                    onClick={() => onAddShot(sh.id)}
                    title="Place this shot on the canvas"
                    className="rounded border border-border px-2 py-1 text-left text-xs text-zinc-300 hover:border-accent"
                  >
                    Shot {sh.name}
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

function PaletteButton({
  icon,
  label,
  onClick,
}: {
  icon: string
  label: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs text-zinc-200 hover:border-accent hover:bg-surface"
    >
      <span className="flex h-5 w-5 items-center justify-center rounded bg-surface text-[11px] text-zinc-400">
        {icon}
      </span>
      {label}
    </button>
  )
}
