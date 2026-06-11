import { useEffect, useRef, useState } from 'react'
import { mediaUrl } from '@shared/media'
import type { Shot } from '@shared/types'
import { useShotStore } from '../../store/shotStore'
import { useAssetStore } from '../../store/assetStore'

/**
 * The shot-sequencer timeline: ordered shot columns, each with an Input row (the
 * imported asset) and an Output row (the chosen ComfyUI result — Slice B). Import
 * adds shots; drag a card to reorder; click to preview; double-click the name to rename.
 */
export function TimelinePanel(): React.JSX.Element {
  const { shots, selectedId, error, load, importAsShots, reorder, select } = useShotStore()
  const selectAsset = useAssetStore((s) => s.select)
  const dragId = useRef<string | null>(null)

  useEffect(() => {
    void load()
  }, [load])

  const onSelect = (shot: Shot): void => {
    select(shot.id)
    if (shot.inputAssetId) selectAsset(shot.inputAssetId)
  }

  const onDrop = (targetId: string): void => {
    const from = dragId.current
    dragId.current = null
    if (!from || from === targetId) return
    const ids = shots.map((s) => s.id).filter((id) => id !== from)
    const at = ids.indexOf(targetId)
    ids.splice(at, 0, from)
    void reorder(ids)
  }

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          Shots {shots.length > 0 && <span className="text-zinc-600">· {shots.length}</span>}
        </span>
        <button
          onClick={() => void importAsShots()}
          className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white"
        >
          Import as shots
        </button>
      </div>

      {error && <p className="px-3 py-1 text-xs text-red-400">{error}</p>}

      {shots.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
          <p className="text-sm text-zinc-500">No shots yet</p>
          <p className="text-xs text-zinc-600">Import images or videos — each becomes a shot.</p>
        </div>
      ) : (
        <div className="flex flex-1 gap-3 overflow-x-auto p-3">
          {shots.map((shot) => (
            <ShotCard
              key={shot.id}
              shot={shot}
              selected={shot.id === selectedId}
              onSelect={() => onSelect(shot)}
              onDragStart={() => (dragId.current = shot.id)}
              onDrop={() => onDrop(shot.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ShotCard({
  shot,
  selected,
  onSelect,
  onDragStart,
  onDrop,
}: {
  shot: Shot
  selected: boolean
  onSelect: () => void
  onDragStart: () => void
  onDrop: () => void
}): React.JSX.Element {
  const asset = useAssetStore((s) => s.assets.find((a) => a.id === shot.inputAssetId))
  const { rename, remove } = useShotStore()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(shot.name)
  const inputUrl = asset ? mediaUrl(asset.filePath) : null

  const commitName = (): void => {
    setEditing(false)
    const trimmed = name.trim()
    if (trimmed && trimmed !== shot.name) void rename(shot.id, trimmed)
    else setName(shot.name)
  }

  return (
    <div
      draggable={!editing}
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onClick={onSelect}
      className={`group flex w-44 shrink-0 flex-col rounded-lg border ${
        selected ? 'border-accent' : 'border-border'
      } bg-panel`}
    >
      <div className="flex items-center justify-between px-2 py-1">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName()
              if (e.key === 'Escape') {
                setName(shot.name)
                setEditing(false)
              }
            }}
            onBlur={commitName}
            className="w-full rounded border border-accent bg-surface px-1 text-xs text-zinc-100 outline-none"
          />
        ) : (
          <span
            onDoubleClick={(e) => {
              e.stopPropagation()
              setEditing(true)
            }}
            className="truncate text-xs font-medium text-zinc-200"
            title="Double-click to rename"
          >
            {shot.name}
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation()
            void remove(shot.id)
          }}
          title="Delete shot"
          className="ml-1 hidden text-xs text-zinc-500 group-hover:block hover:text-red-400"
        >
          ✕
        </button>
      </div>

      <Row label="Input">
        {inputUrl ? (
          asset?.kind === 'video' ? (
            <video src={inputUrl} muted preload="metadata" className="h-full w-full object-cover" />
          ) : (
            <img src={inputUrl} alt="" className="h-full w-full object-cover" />
          )
        ) : (
          <span className="text-[10px] text-zinc-600">missing</span>
        )}
      </Row>

      <Row label="Output">
        {shot.heroTakeId ? (
          <span className="text-[10px] text-zinc-500">take selected</span>
        ) : (
          <span className="text-[10px] text-zinc-600">no output yet</span>
        )}
      </Row>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="border-t border-border">
      <div className="px-2 pt-1 text-[9px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="m-1 flex aspect-video items-center justify-center overflow-hidden rounded bg-black/40">
        {children}
      </div>
    </div>
  )
}
