import type { ReactNode } from 'react'
import { NodeResizer } from '@xyflow/react'
import { useMoodboardStore } from '../../../store/moodboardStore'

/**
 * Shared chrome for every moodboard node: a fill container, a resize handle +
 * delete button when selected. Resize persists on end; delete removes the item.
 */
export function NodeFrame({
  id,
  selected,
  minWidth = 80,
  minHeight = 40,
  padded = true,
  children,
}: {
  id: string
  selected: boolean
  minWidth?: number
  minHeight?: number
  padded?: boolean
  children: ReactNode
}): React.JSX.Element {
  const updateItem = useMoodboardStore((s) => s.updateItem)
  const deleteItem = useMoodboardStore((s) => s.deleteItem)

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={minWidth}
        minHeight={minHeight}
        lineClassName="!border-accent"
        handleClassName="!bg-accent !border-white"
        onResizeEnd={(_e, p) => void updateItem(id, { width: p.width, height: p.height })}
      />
      <div
        className={`h-full w-full overflow-hidden rounded-md border bg-surface ${
          selected ? 'border-accent' : 'border-border'
        } ${padded ? 'p-1' : ''}`}
      >
        {children}
      </div>
      {selected && (
        <button
          onClick={() => void deleteItem(id)}
          title="Delete"
          className="absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/80 text-xs text-zinc-200 hover:text-red-400"
        >
          ✕
        </button>
      )}
    </>
  )
}
