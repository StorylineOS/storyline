import { useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { mediaUrl } from '@shared/media'
import { useShotStore } from '../../../store/shotStore'
import { useAssetStore } from '../../../store/assetStore'
import { useUiStore } from '../../../store/uiStore'
import { NodeFrame } from './NodeFrame'

interface ShotNodeData extends Record<string, unknown> {
  shotId: string
}

/** Small, both-source-and-target (loose mode) handle for purely-visual shot links. */
function VisualHandle({ id, position }: { id: string; position: Position }): React.JSX.Element {
  return (
    <Handle
      type="source"
      id={id}
      position={position}
      className="!h-2.5 !w-2.5 !border !border-zinc-800 !bg-zinc-500 opacity-60 hover:!bg-accent hover:opacity-100"
    />
  )
}

/**
 * A shot on the canvas, styled like a preview: the body shows the shot's hero
 * input (carousel + "set as hero" when it has several). The header carries the
 * functional Output handle (wire it to a Preview/output node to see the result).
 * Three side handles allow purely-visual shot↔shot links (Miro-style).
 */
export function ShotNode({ id, data, selected }: NodeProps): React.JSX.Element {
  const { shotId } = data as ShotNodeData
  const shot = useShotStore((s) => s.shots.find((sh) => sh.id === shotId))
  const inputs = useShotStore((s) => s.inputsByShot[shotId]) ?? []
  const busy = useShotStore((s) => s.busyId === shotId)
  const linkShot = useShotStore((s) => s.linkShot)
  const reorderInputs = useShotStore((s) => s.reorderInputs)
  const assets = useAssetStore((s) => s.assets)
  const setMode = useUiStore((s) => s.setMode)
  const setLinkedWorkflow = useUiStore((s) => s.setLinkedWorkflow)
  const setActiveShot = useUiStore((s) => s.setActiveShot)
  const [idx, setIdx] = useState(0)

  const thumbs = inputs
    .map((i) => assets.find((a) => a.id === i.assetId))
    .filter((a): a is NonNullable<typeof a> => !!a)
  const count = thumbs.length
  const safeIdx = count ? Math.min(idx, count - 1) : 0
  const cur = count ? thumbs[safeIdx] : undefined
  const linked = !!shot?.comfyWorkflowName

  const onLink = async (): Promise<void> => {
    if (!shot) return
    const result = await linkShot(shot.id)
    setLinkedWorkflow(result?.comfyWorkflowName ?? shot.comfyWorkflowName)
    setActiveShot(shot.id)
    setMode('generate')
  }

  const makeHero = (): void => {
    if (!cur || safeIdx === 0) return
    const ordered = [cur.id, ...thumbs.filter((_, i) => i !== safeIdx).map((a) => a.id)]
    void reorderInputs(shotId, ordered)
    setIdx(0)
  }

  return (
    <>
      <NodeFrame id={id} selected={!!selected} minWidth={200} minHeight={170} padded={false}>
        <div className="flex h-full w-full flex-col">
          <div className="flex items-center gap-1.5 border-b border-border bg-panel px-2 py-1">
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-zinc-100">
              Shot {shot?.name ?? '—'}
            </span>
            <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-indigo-300">
              Output
              <Handle
                type="source"
                id="out"
                position={Position.Right}
                style={{
                  position: 'relative',
                  top: 'auto',
                  right: 'auto',
                  left: 'auto',
                  transform: 'none',
                }}
                className="!h-3 !w-3 !border-2 !border-surface !bg-indigo-400"
              />
            </span>
          </div>

          <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
            {cur ? (
              cur.kind === 'video' ? (
                <video
                  src={mediaUrl(cur.filePath)}
                  muted
                  preload="metadata"
                  className="max-h-full max-w-full object-contain"
                />
              ) : cur.kind === 'audio' ? (
                <span className="text-2xl">🎵</span>
              ) : (
                <img
                  src={mediaUrl(cur.filePath)}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                />
              )
            ) : (
              <span className="p-3 text-center text-[11px] text-zinc-600">
                Drop an asset to set this shot&apos;s input
              </span>
            )}

            <button
              onClick={() => void onLink()}
              disabled={busy}
              title={linked ? 'Open the linked ComfyUI workflow' : 'Link a ComfyUI workflow'}
              className="nodrag absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-zinc-100 hover:bg-black/90 disabled:opacity-40"
            >
              {busy ? '…' : linked ? '🔗 Open Workflow' : '⛓ Link Workflow'}
            </button>

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
                  {thumbs.map((a, i) => (
                    <span
                      key={a.id}
                      className={`h-1.5 w-1.5 rounded-full ${
                        i === safeIdx ? 'bg-white' : 'bg-zinc-500'
                      }`}
                    />
                  ))}
                </div>
                {safeIdx === 0 ? (
                  <span className="absolute left-1 top-1 rounded bg-emerald-500/80 px-1 text-[9px] font-medium text-white">
                    Hero
                  </span>
                ) : (
                  <button
                    onClick={makeHero}
                    title="Use this input as the hero"
                    className="nodrag absolute left-1 top-1 rounded bg-black/60 px-1 text-[9px] text-amber-300 hover:bg-black/80"
                  >
                    ★ Set hero
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </NodeFrame>

      {/* Visual-only links (no data flow), connectable on all four sides. */}
      <VisualHandle id="vt" position={Position.Top} />
      <VisualHandle id="vl" position={Position.Left} />
      <VisualHandle id="vr" position={Position.Right} />
      <VisualHandle id="vb" position={Position.Bottom} />
    </>
  )
}
