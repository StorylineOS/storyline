import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { NodeProps } from '@xyflow/react'
import { NodeFrame } from './NodeFrame'
import { useMoodboardStore } from '../../../store/moodboardStore'
import type { TextNodeData } from './nodeData'

/** Editable text item. Double-click to edit; blur persists. Formatting toolbar is slice 2. */
export function TextNode({ id, data, selected }: NodeProps): React.JSX.Element {
  const { text } = data as TextNodeData
  const updateItem = useMoodboardStore((s) => s.updateItem)
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const style: CSSProperties = {
    fontSize: text.fontSize,
    color: text.color,
    textAlign: text.align,
    fontWeight: text.bold ? 700 : 400,
    fontStyle: text.italic ? 'italic' : 'normal',
    textDecoration: text.underline ? 'underline' : 'none',
  }

  const commit = (): void => {
    setEditing(false)
    const next = ref.current?.innerText ?? text.text
    if (next !== text.text) void updateItem(id, { data: { text: { ...text, text: next } } })
  }

  return (
    <NodeFrame id={id} selected={!!selected} minHeight={32}>
      <div
        ref={ref}
        style={style}
        className={`h-full w-full whitespace-pre-wrap break-words px-1 outline-none ${
          editing ? 'nodrag cursor-text' : 'cursor-grab'
        }`}
        contentEditable={editing}
        suppressContentEditableWarning
        onDoubleClick={() => setEditing(true)}
        onBlur={commit}
      >
        {text.text}
      </div>
    </NodeFrame>
  )
}
