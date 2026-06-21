import type { NodeProps } from '@xyflow/react'
import { NodeFrame } from './NodeFrame'
import type { AssetNodeData } from './nodeData'
import { useMediaContextMenu } from '../../../lib/mediaContextMenu'

export function ImageNode({ id, data, selected }: NodeProps): React.JSX.Element {
  const { src, name } = data as AssetNodeData
  const onContextMenu = useMediaContextMenu()
  return (
    <NodeFrame id={id} selected={!!selected} padded={false}>
      <img
        src={src}
        alt={name}
        draggable={false}
        onContextMenu={(e) => onContextMenu(e, { src, name, kind: 'image' })}
        className="h-full w-full object-cover"
      />
    </NodeFrame>
  )
}
