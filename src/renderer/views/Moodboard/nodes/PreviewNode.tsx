import { Handle, Position, type NodeProps } from '@xyflow/react'
import { mediaUrl } from '@shared/media'
import { useMoodboardStore } from '../../../store/moodboardStore'
import { useShotStore } from '../../../store/shotStore'
import { NodeFrame } from './NodeFrame'

/**
 * A Comfy-style preview node: connect a shot's output handle to its input and it
 * displays that shot's hero output. Source is resolved via the moodboard connector
 * feeding this node (shot item → preview).
 */
export function PreviewNode({ id, selected }: NodeProps): React.JSX.Element {
  const connectors = useMoodboardStore((s) => s.connectors)
  const items = useMoodboardStore((s) => s.items)
  const shots = useShotStore((s) => s.shots)
  const takesByShot = useShotStore((s) => s.takesByShot)

  const conn = connectors.find((c) => c.toItemId === id)
  const sourceItem = conn ? items.find((it) => it.id === conn.fromItemId) : undefined
  const shot = sourceItem?.shotId ? shots.find((s) => s.id === sourceItem.shotId) : undefined
  const hero = shot ? (takesByShot[shot.id] ?? []).find((t) => t.id === shot.heroTakeId) : undefined

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className="!h-3.5 !w-3.5 !border-2 !border-surface !bg-indigo-400"
      />
      <NodeFrame id={id} selected={!!selected} minWidth={220} minHeight={170} padded={false}>
        <div className="flex h-full w-full flex-col">
          <div className="flex items-center gap-1 border-b border-border bg-panel px-2 py-1">
            <span className="text-[10px] text-indigo-400">▣</span>
            <span className="flex-1 truncate text-[11px] font-medium text-zinc-300">
              Preview{shot ? ` · Shot ${shot.name}` : ''}
            </span>
          </div>
          <div className="flex flex-1 items-center justify-center bg-black">
            {hero ? (
              hero.kind === 'video' ? (
                <video src={mediaUrl(hero.filePath)} controls className="max-h-full max-w-full" />
              ) : (
                <img
                  src={mediaUrl(hero.filePath)}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                />
              )
            ) : (
              <span className="p-3 text-center text-[11px] text-zinc-500">
                Connect a shot&apos;s output here to preview it
              </span>
            )}
          </div>
        </div>
      </NodeFrame>
    </>
  )
}
