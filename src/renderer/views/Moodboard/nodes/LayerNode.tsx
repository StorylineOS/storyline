import { useState } from 'react'
import { NodeResizer, type NodeProps } from '@xyflow/react'
import { useMoodboardStore } from '../../../store/moodboardStore'

interface LayerNodeData extends Record<string, unknown> {
  name: string
}

/**
 * A resizable, renamable group container. Shots dropped inside become its React
 * Flow children and move with it. Only the title bar (.drag-handle) drags the
 * layer, so dragging over the body doesn't fight with the child shots.
 */
export function LayerNode({ id, data, selected }: NodeProps): React.JSX.Element {
  const name = (data as LayerNodeData).name || 'Layer'
  const updateItem = useMoodboardStore((s) => s.updateItem)
  const deleteItem = useMoodboardStore((s) => s.deleteItem)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)

  const commit = (): void => {
    setEditing(false)
    const next = draft.trim() || 'Layer'
    if (next !== name) void updateItem(id, { data: { name: next } })
  }

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={220}
        minHeight={160}
        lineClassName="!border-accent"
        handleClassName="!h-2 !w-2 !rounded-sm !bg-accent !border-white"
        onResizeEnd={(_e, p) => void updateItem(id, { width: p.width, height: p.height })}
      />
      {/* Body ignores pointer events so clicks fall through to the shots and
          connectors drawn inside the layer; only the title bar is interactive. */}
      <div
        className={`pointer-events-none flex h-full w-full flex-col overflow-hidden rounded-lg border-2 ${
          selected ? 'border-accent' : 'border-dashed border-zinc-600'
        } bg-accent/5`}
      >
        <div className="drag-handle pointer-events-auto flex cursor-grab items-center gap-2 border-b border-border bg-panel px-2 py-1">
          <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent">
            Layer
          </span>
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') setEditing(false)
              }}
              className="nodrag min-w-0 flex-1 bg-transparent text-xs font-medium text-zinc-100 outline-none"
            />
          ) : (
            <span
              onDoubleClick={() => {
                setDraft(name)
                setEditing(true)
              }}
              title="Double-click to rename"
              className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-200"
            >
              {name}
            </span>
          )}
          {selected && (
            <button
              onClick={() => void deleteItem(id)}
              title="Delete layer"
              className="nodrag shrink-0 text-zinc-400 hover:text-red-400"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </>
  )
}
