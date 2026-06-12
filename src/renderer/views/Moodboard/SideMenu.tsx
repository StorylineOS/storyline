import { useState } from 'react'
import { mediaUrl } from '@shared/media'
import { useAssetStore } from '../../store/assetStore'
import { useShotStore } from '../../store/shotStore'

type Tab = 'assets' | 'nodes' | 'gallery'

/**
 * Collapsible left rail for the canvas: Assets (drop a library asset as a shot),
 * Nodes (add Preview / Text), Gallery (place an existing shot on the canvas).
 */
export function SideMenu({
  onAddShotFromAsset,
  onAddShot,
  onAddPreview,
  onAddText,
  onImport,
}: {
  onAddShotFromAsset: (assetId: string) => void
  onAddShot: (shotId: string) => void
  onAddPreview: () => void
  onAddText: () => void
  onImport: () => void
}): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('assets')
  const [open, setOpen] = useState(true)
  const assets = useAssetStore((s) => s.assets)
  const shots = useShotStore((s) => s.shots)

  const tabs: { key: Tab; label: string }[] = [
    { key: 'assets', label: 'Assets' },
    { key: 'nodes', label: 'Nodes' },
    { key: 'gallery', label: 'Gallery' },
  ]

  if (!open) {
    return (
      <div className="flex w-9 shrink-0 flex-col items-center gap-2 border-r border-border bg-panel py-2">
        <button
          onClick={() => setOpen(true)}
          title="Expand"
          className="text-zinc-400 hover:text-white"
        >
          ▸
        </button>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key)
              setOpen(true)
            }}
            className="rotate-180 text-[10px] text-zinc-500 [writing-mode:vertical-rl] hover:text-zinc-200"
          >
            {t.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex w-56 shrink-0 flex-col border-r border-border bg-panel">
      <div className="flex items-center justify-between border-b border-border px-1 py-1">
        <div className="flex gap-0.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded px-2 py-1 text-[11px] ${
                tab === t.key ? 'bg-accent text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setOpen(false)}
          title="Collapse"
          className="px-1 text-zinc-500 hover:text-white"
        >
          ◂
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {tab === 'assets' && (
          <>
            <button
              onClick={onImport}
              className="mb-2 w-full rounded-md bg-accent px-2 py-1 text-xs font-medium text-white"
            >
              Import
            </button>
            {assets.length === 0 ? (
              <p className="text-xs text-zinc-600">No media yet — Import to add.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {assets.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => onAddShotFromAsset(a.id)}
                    title={`Add "${a.name}" as a shot`}
                    className="flex flex-col overflow-hidden rounded border border-border text-left hover:border-accent"
                  >
                    <div className="flex aspect-video items-center justify-center bg-black/40">
                      {a.kind === 'image' && (
                        <img
                          src={mediaUrl(a.filePath)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )}
                      {a.kind === 'video' && (
                        <video
                          src={mediaUrl(a.filePath)}
                          muted
                          preload="metadata"
                          className="h-full w-full object-cover"
                        />
                      )}
                      {a.kind === 'audio' && <span className="text-lg">🎵</span>}
                    </div>
                    <span className="truncate px-1 py-0.5 text-[10px] text-zinc-400">{a.name}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'nodes' && (
          <div className="flex flex-col gap-1.5">
            <button
              onClick={onAddPreview}
              className="rounded-md border border-border px-2 py-1.5 text-xs text-zinc-200 hover:bg-surface"
            >
              + Preview node
            </button>
            <button
              onClick={onAddText}
              className="rounded-md border border-border px-2 py-1.5 text-xs text-zinc-200 hover:bg-surface"
            >
              + Text
            </button>
          </div>
        )}

        {tab === 'gallery' && (
          <>
            {shots.length === 0 ? (
              <p className="text-xs text-zinc-600">No shots yet.</p>
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
          </>
        )}
      </div>
    </div>
  )
}
