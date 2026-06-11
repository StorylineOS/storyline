import type { NodeProps } from '@xyflow/react'
import { NodeFrame } from './NodeFrame'
import type { AssetNodeData } from './nodeData'

export function ImageNode({ id, data, selected }: NodeProps): React.JSX.Element {
  const { src, name } = data as AssetNodeData
  return (
    <NodeFrame id={id} selected={!!selected} padded={false}>
      <img src={src} alt={name} draggable={false} className="h-full w-full object-cover" />
    </NodeFrame>
  )
}
