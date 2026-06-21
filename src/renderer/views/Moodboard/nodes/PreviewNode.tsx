import { useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { mediaUrl } from '@shared/media'
import { useMoodboardStore } from '../../../store/moodboardStore'
import { useFrameStore } from '../../../store/frameStore'
import { useMediaContextMenu } from '../../../lib/mediaContextMenu'
import { NodeFrame } from './NodeFrame'

/**
 * A Comfy-style preview node: connect a frame's output handle to its input and it
 * displays that frame's outputs (takes). With several takes it becomes a carousel —
 * page through them and "set hero" to pick the one the timeline points at.
 */
export function PreviewNode({ id, selected }: NodeProps): React.JSX.Element {
  const connectors = useMoodboardStore((s) => s.connectors)
  const items = useMoodboardStore((s) => s.items)
  const frames = useFrameStore((s) => s.frames)
  const takesByFrame = useFrameStore((s) => s.takesByFrame)
  const setHero = useFrameStore((s) => s.setHero)
  const onMediaContextMenu = useMediaContextMenu()
  const [idx, setIdx] = useState(0)

  const conn = connectors.find((c) => c.toItemId === id)
  const sourceItem = conn ? items.find((it) => it.id === conn.fromItemId) : undefined
  const frame = sourceItem?.frameId ? frames.find((s) => s.id === sourceItem.frameId) : undefined

  // Outputs newest-first, but float the hero take to the front so it shows by default.
  const takes = frame ? (takesByFrame[frame.id] ?? []) : []
  const heroId = frame?.heroTakeId ?? null
  const ordered = [...takes]
  if (heroId) {
    const i = ordered.findIndex((t) => t.id === heroId)
    if (i > 0) ordered.unshift(ordered.splice(i, 1)[0])
  }

  const count = ordered.length
  const safeIdx = count ? Math.min(idx, count - 1) : 0
  const cur = count ? ordered[safeIdx] : undefined
  const curIsHero = !!cur && cur.id === heroId

  const makeHero = (): void => {
    if (frame && cur && !curIsHero) void setHero(frame.id, cur.id)
  }

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className="!h-3.5 !w-3.5 !border-2 !border-surface !bg-indigo-400"
      />
      {/* Output handle: wire to a Frame's input to feed it the selected (hero) take. */}
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        title="Feed the selected output into a frame's input"
        className="!h-3.5 !w-3.5 !border-2 !border-surface !bg-emerald-400"
      />
      <NodeFrame id={id} selected={!!selected} minWidth={220} minHeight={170} padded={false}>
        <div className="flex h-full w-full flex-col">
          <div className="flex items-center gap-1 border-b border-border bg-panel px-2 py-1">
            <span className="text-[10px] text-indigo-400">▣</span>
            <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-zinc-300">
              Preview{frame ? ` · Frame ${frame.name}` : ''}
            </span>
            {count > 0 && (
              <span className="shrink-0 text-[10px] text-zinc-500">
                {safeIdx + 1}/{count}
              </span>
            )}
          </div>
          <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
            {cur ? (
              cur.kind === 'video' ? (
                <video
                  src={mediaUrl(cur.filePath)}
                  controls
                  onContextMenu={(e) =>
                    onMediaContextMenu(e, {
                      src: mediaUrl(cur.filePath),
                      name: frame ? `Frame ${frame.name}` : 'take',
                      kind: 'video',
                    })
                  }
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <img
                  src={mediaUrl(cur.filePath)}
                  alt=""
                  onContextMenu={(e) =>
                    onMediaContextMenu(e, {
                      src: mediaUrl(cur.filePath),
                      name: frame ? `Frame ${frame.name}` : 'take',
                      kind: cur.kind,
                    })
                  }
                  className="max-h-full max-w-full object-contain"
                />
              )
            ) : (
              <span className="p-3 text-center text-[11px] text-zinc-500">
                {frame
                  ? 'No outputs yet — generate this frame in ComfyUI.'
                  : "Connect a frame's output here to preview it"}
              </span>
            )}

            {count > 1 && (
              <>
                <button
                  onClick={() => setIdx(() => (safeIdx - 1 + count) % count)}
                  className="nodrag absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-1.5 text-sm text-white hover:bg-black/80"
                >
                  ‹
                </button>
                <button
                  onClick={() => setIdx(() => (safeIdx + 1) % count)}
                  className="nodrag absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-1.5 text-sm text-white hover:bg-black/80"
                >
                  ›
                </button>
                <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5">
                  {ordered.map((t, i) => (
                    <span
                      key={t.id}
                      className={`h-1.5 w-1.5 rounded-full ${i === safeIdx ? 'bg-white' : 'bg-zinc-500'}`}
                    />
                  ))}
                </div>
              </>
            )}

            {cur &&
              (curIsHero ? (
                <span className="absolute left-1 top-1 rounded bg-emerald-500/80 px-1 text-[9px] font-medium text-white">
                  Hero
                </span>
              ) : (
                <button
                  onClick={makeHero}
                  title="Use this take as the frame's hero"
                  className="nodrag absolute left-1 top-1 rounded bg-black/60 px-1 text-[9px] text-amber-300 hover:bg-black/80"
                >
                  ★ Set hero
                </button>
              ))}
          </div>
        </div>
      </NodeFrame>
    </>
  )
}
