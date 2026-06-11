import type { NodeProps } from '@xyflow/react'
import { NodeFrame } from './NodeFrame'
import type { AssetNodeData } from './nodeData'

export function VideoNode({ id, data, selected }: NodeProps): React.JSX.Element {
  const { src } = data as AssetNodeData
  // `nodrag` lets the player controls work without the canvas dragging the node.
  return (
    <NodeFrame id={id} selected={!!selected} padded={false}>
      <video src={src} controls className="nodrag h-full w-full bg-black object-contain" />
    </NodeFrame>
  )
}
