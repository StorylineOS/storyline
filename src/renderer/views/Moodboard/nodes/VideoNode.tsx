import type { NodeProps } from '@xyflow/react'
import { NodeFrame } from './NodeFrame'
import type { AssetNodeData } from './nodeData'
import { useMediaContextMenu } from '../../../lib/mediaContextMenu'

export function VideoNode({ id, data, selected }: NodeProps): React.JSX.Element {
  const { src, name } = data as AssetNodeData
  const onContextMenu = useMediaContextMenu()
  // `nodrag` lets the player controls work without the canvas dragging the node.
  return (
    <NodeFrame id={id} selected={!!selected} padded={false}>
      <video
        src={src}
        controls
        onContextMenu={(e) => onContextMenu(e, { src, name, kind: 'video' })}
        className="nodrag h-full w-full bg-black object-contain"
      />
    </NodeFrame>
  )
}
