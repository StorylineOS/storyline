import type { NodeProps } from '@xyflow/react'
import { NodeFrame } from './NodeFrame'
import type { AssetNodeData } from './nodeData'

export function AudioNode({ id, data, selected }: NodeProps): React.JSX.Element {
  const { src, name } = data as AssetNodeData
  return (
    <NodeFrame id={id} selected={!!selected}>
      <div className="flex h-full w-full flex-col justify-center gap-1 px-2">
        <span className="truncate text-[11px] text-zinc-400">🎵 {name}</span>
        <audio src={src} controls className="nodrag w-full" />
      </div>
    </NodeFrame>
  )
}
