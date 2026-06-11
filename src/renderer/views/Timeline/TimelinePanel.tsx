import { useEffect, useRef, useState } from 'react'
import { mediaUrl } from '@shared/media'
import type { Shot } from '@shared/types'
import { useShotStore } from '../../store/shotStore'
import { useAssetStore } from '../../store/assetStore'
import { useUiStore } from '../../store/uiStore'
import { ASSET_DND_TYPE } from '../../lib/dnd'

/**
 * The shot-sequencer timeline: ordered shot columns, each with an Input row (the
 * imported asset) and an Output row (the chosen ComfyUI result — Slice B). Import
 * adds shots; drag a card to reorder; click to preview; double-click the name to rename.
 */
export function TimelinePanel(): React.JSX.Element {
  const {
    shots,
    selectedId,
    error,
    notice,
    load,
    importAsShots,
    addFromAsset,
    reorder,
    select,
    exportShots,
  } = useShotStore()
  const selectAsset = useAssetStore((s) => s.select)
  const dragId = useRef<string | null>(null)
  const [dropActive, setDropActive] = useState(false)

  useEffect(() => {
    void load()
  }, [load])

  /** Allow dropping a Library asset (sets the copy cursor + highlight). */
  const onAssetDragOver = (e: React.DragEvent): void => {
    if (e.dataTransfer.types.includes(ASSET_DND_TYPE)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setDropActive(true)
    }
  }

  /** Drop a Library asset anywhere on the strip → create a shot from it. */
  const onAssetDrop = (e: React.DragEvent): void => {
    const assetId = e.dataTransfer.getData(ASSET_DND_TYPE)
    setDropActive(false)
    if (assetId) {
      e.preventDefault()
      void addFromAsset(assetId)
    }
  }

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
          Shots Sequence{' '}
          {shots.length > 0 && <span className="text-zinc-600">· {shots.length}</span>}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => void exportShots()}
            disabled={shots.length === 0}
            className="rounded-md border border-border px-2.5 py-1 text-xs text-zinc-300 hover:bg-panel disabled:opacity-40"
          >
            Export
          </button>
          <button
            onClick={() => void importAsShots()}
            className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white"
          >
            Import as shots
          </button>
        </div>
      </div>

      {error && <p className="px-3 py-1 text-xs text-red-400">{error}</p>}
      {notice && <p className="px-3 py-1 text-xs text-green-400">{notice}</p>}

      <div
        onDragOver={onAssetDragOver}
        onDragLeave={() => setDropActive(false)}
        onDrop={onAssetDrop}
        className={`min-h-0 flex-1 ${dropActive ? 'rounded ring-2 ring-inset ring-accent' : ''}`}
      >
        {shots.length === 0 ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm text-zinc-500">No shots yet</p>
            <p className="text-xs text-zinc-600">
              Drag assets here from the library, or import images/videos — each becomes a shot.
            </p>
          </div>
        ) : (
          <div className="flex h-full w-full gap-3 overflow-x-auto p-3">
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
  const output = useShotStore((s) => s.outputs[shot.id])
  const busy = useShotStore((s) => s.busyId === shot.id)
  const { rename, remove, sendToComfy, pullResult } = useShotStore()
  const setMode = useUiStore((s) => s.setMode)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(shot.name)
  const inputUrl = asset ? mediaUrl(asset.filePath) : null
  const outputUrl = output ? mediaUrl(output.filePath) : null

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
        {outputUrl ? (
          output?.kind === 'video' ? (
            <video
              src={outputUrl}
              muted
              preload="metadata"
              className="h-full w-full object-cover"
            />
          ) : (
            <img src={outputUrl} alt="" className="h-full w-full object-cover" />
          )
        ) : (
          <span className="text-[10px] text-zinc-600">no output yet</span>
        )}
      </Row>

      {selected && (
        <div className="flex gap-1 border-t border-border p-1">
          <button
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation()
              void sendToComfy(shot.id)
              setMode('generate')
            }}
            className="flex-1 rounded bg-accent px-1 py-1 text-[10px] font-medium text-white disabled:opacity-40"
          >
            Send to ComfyUI
          </button>
          <button
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation()
              void pullResult(shot.id)
            }}
            className="flex-1 rounded border border-border px-1 py-1 text-[10px] text-zinc-300 hover:bg-surface disabled:opacity-40"
          >
            {busy ? '…' : 'Pull result'}
          </button>
        </div>
      )}
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
