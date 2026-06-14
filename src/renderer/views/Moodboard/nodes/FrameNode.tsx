import { useLayoutEffect, useRef, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { mediaUrl } from '@shared/media'
import { useFrameStore } from '../../../store/frameStore'
import { useAssetStore } from '../../../store/assetStore'
import { useMoodboardStore } from '../../../store/moodboardStore'
import { useUiStore } from '../../../store/uiStore'
import { getAssetDragIds } from '../../../lib/dnd'
import { NodeFrame } from './NodeFrame'

interface FrameNodeData extends Record<string, unknown> {
  frameId: string
}

/** A resolved carousel thumbnail (from an asset input or a flow/source-frame input). */
type Thumb = { id: string; assetId: string | null; url: string; kind: 'image' | 'video' | 'audio' }

// Bounds for the media body when fitting to a media's aspect ratio — keeps very
// wide/tall inputs from collapsing or ballooning the node.
const MIN_BODY = 160
const MAX_BODY = 480

/** Small, both-source-and-target (loose mode) handle for purely-visual frame links. */
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
 * A frame on the canvas, styled like a preview: the body shows the frame's hero
 * input (carousel + "set as hero" when it has several). The header carries the
 * functional Output handle (wire it to a Preview/output node to see the result).
 * Three side handles allow purely-visual frame↔frame links (Miro-style).
 */
export function FrameNode({ id, data, selected }: NodeProps): React.JSX.Element {
  const { frameId } = data as FrameNodeData
  const frame = useFrameStore((s) => s.frames.find((sh) => sh.id === frameId))
  const inputs = useFrameStore((s) => s.inputsByFrame[frameId]) ?? []
  const busy = useFrameStore((s) => s.busyId === frameId)
  const linkFrame = useFrameStore((s) => s.linkFrame)
  const uploadInputs = useFrameStore((s) => s.uploadInputs)
  const reorderInputs = useFrameStore((s) => s.reorderInputs)
  const addInputs = useFrameStore((s) => s.addInputs)
  const allFrames = useFrameStore((s) => s.frames)
  const takesByFrame = useFrameStore((s) => s.takesByFrame)
  const assets = useAssetStore((s) => s.assets)
  const item = useMoodboardStore((s) => s.items.find((it) => it.id === id))
  const updateItem = useMoodboardStore((s) => s.updateItem)
  const setMode = useUiStore((s) => s.setMode)
  const setLinkedWorkflow = useUiStore((s) => s.setLinkedWorkflow)
  const setActiveFrame = useUiStore((s) => s.setActiveFrame)
  const [idx, setIdx] = useState(0)
  // True while assets are dragged over the frame — highlights it as a drop target.
  const [dropActive, setDropActive] = useState(false)
  // Aspect ratio of the current media; drives the node height so the image fills
  // the body with no black letterboxing.
  const [aspect, setAspect] = useState<number | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  // Signature of the last applied fit (aspect + width); guards against re-firing
  // the height update on every render, which would loop and freeze the canvas.
  const lastFit = useRef<string>('')

  // Resolve each input to a thumbnail: asset inputs → their media; flow inputs
  // (sourceFrameId from a connected Preview) → that frame's hero take.
  const thumbs = inputs
    .map((i): Thumb | null => {
      if (i.assetId) {
        const a = assets.find((x) => x.id === i.assetId)
        return a ? { id: i.id, assetId: a.id, url: mediaUrl(a.filePath), kind: a.kind } : null
      }
      if (i.sourceFrameId) {
        const sf = allFrames.find((f) => f.id === i.sourceFrameId)
        const takes = sf ? (takesByFrame[sf.id] ?? []) : []
        // Mirror the Preview: the hero take, or the newest when no hero is set.
        const take = takes.find((t) => t.id === sf?.heroTakeId) ?? takes[0]
        return take
          ? { id: i.id, assetId: null, url: mediaUrl(take.filePath), kind: take.kind }
          : null
      }
      return null
    })
    .filter((t): t is Thumb => !!t)
  const count = thumbs.length
  const safeIdx = count ? Math.min(idx, count - 1) : 0
  const cur = count ? thumbs[safeIdx] : undefined
  const linked = !!frame?.comfyWorkflowName

  // Fit the node height to the media's aspect ratio at the current width, so the
  // body shows the image edge-to-edge with no black bars. The `lastFit` guard makes
  // this fire at most once per (aspect, width) pair — so the resulting height change
  // (which re-renders this node) can never feed back into another resize.
  const itemWidth = item?.width
  const itemHeight = item?.height
  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!aspect || !body || itemHeight == null || itemWidth == null) return
    const sig = `${aspect.toFixed(4)}:${itemWidth}`
    if (lastFit.current === sig) return
    const width = body.clientWidth
    if (!width) return
    lastFit.current = sig
    const targetBody = Math.max(MIN_BODY, Math.min(MAX_BODY, width / aspect))
    const delta = targetBody - body.clientHeight
    if (Math.abs(delta) < 1) return
    // Programmatic layout fit — don't pollute the undo history.
    void updateItem(id, { height: Math.round(itemHeight + delta) }, false)
  }, [aspect, itemWidth, itemHeight, id, updateItem])

  // Drop the aspect lock when the visible input isn't an image/video (audio or none).
  const curKind = cur?.kind
  useLayoutEffect(() => {
    if (curKind !== 'image' && curKind !== 'video') setAspect(null)
  }, [curKind])

  const onLink = async (): Promise<void> => {
    if (!frame) return
    const result = await linkFrame(frame.id)
    setLinkedWorkflow(result?.comfyWorkflowName ?? frame.comfyWorkflowName)
    setActiveFrame(frame.id)
    setMode('generate')
    // Push this frame's inputs to ComfyUI so they're available in LoadImage — the
    // cloud-safe path (no shared local folder needed). Best-effort.
    void uploadInputs(frame.id)
  }

  // Move the current input to the front. Reordering is keyed by asset id, so it only
  // applies when every input is asset-backed (flow inputs have no asset id).
  const canReorder = thumbs.every((t) => t.assetId)
  const makeHero = (): void => {
    if (!cur || safeIdx === 0 || !canReorder) return
    const ordered = thumbs
      .slice(safeIdx, safeIdx + 1)
      .concat(thumbs.filter((_, i) => i !== safeIdx))
      .map((t) => t.assetId as string)
    void reorderInputs(frameId, ordered)
    setIdx(0)
  }

  // Accept Library assets dropped onto the frame as inputs. stopPropagation keeps
  // the canvas from also handling the drop (which would spawn new frames). Multiple
  // assets (⌘/Ctrl-multi-select) are added at once; already-present ones are skipped.
  const hasAssetDrag = (e: React.DragEvent): boolean =>
    e.dataTransfer.types.includes('application/x-storyline-asset')

  const onDragOver = (e: React.DragEvent): void => {
    if (!hasAssetDrag(e)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
    if (!dropActive) setDropActive(true)
  }

  const onDrop = (e: React.DragEvent): void => {
    if (!hasAssetDrag(e)) return
    e.preventDefault()
    e.stopPropagation()
    setDropActive(false)
    const existing = new Set(inputs.map((i) => i.assetId))
    const ids = getAssetDragIds(e.dataTransfer).filter((id) => !existing.has(id))
    if (ids.length) void addInputs(frameId, ids)
  }

  return (
    <>
      <NodeFrame id={id} selected={!!selected} minWidth={200} minHeight={170} padded={false}>
        <div
          className="relative flex h-full w-full flex-col"
          onDragOver={onDragOver}
          onDragLeave={() => setDropActive(false)}
          onDrop={onDrop}
        >
          <div className="flex items-center gap-1.5 border-b border-border bg-panel px-2 py-1">
            <span
              className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-emerald-300"
              title="Connect a Preview's output here to feed this frame"
            >
              <Handle
                type="target"
                id="in"
                position={Position.Left}
                style={{
                  position: 'relative',
                  top: 'auto',
                  right: 'auto',
                  left: 'auto',
                  transform: 'none',
                }}
                className="!h-3 !w-3 !border-2 !border-surface !bg-emerald-400"
              />
              Input
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-zinc-100">
              Frame {frame?.name ?? '—'}
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

          <div
            ref={bodyRef}
            className="relative flex flex-1 items-center justify-center overflow-hidden bg-black"
          >
            {cur ? (
              cur.kind === 'video' ? (
                <video
                  src={cur.url}
                  muted
                  preload="metadata"
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget
                    if (v.videoWidth && v.videoHeight) setAspect(v.videoWidth / v.videoHeight)
                  }}
                  className="h-full w-full object-cover"
                />
              ) : cur.kind === 'audio' ? (
                <span className="text-2xl">🎵</span>
              ) : (
                <img
                  src={cur.url}
                  alt=""
                  onLoad={(e) => {
                    const img = e.currentTarget
                    if (img.naturalWidth && img.naturalHeight)
                      setAspect(img.naturalWidth / img.naturalHeight)
                  }}
                  className="h-full w-full object-cover"
                />
              )
            ) : (
              <span className="p-3 text-center text-[11px] text-zinc-600">
                Drop an asset here, or connect a Preview&apos;s output to set this frame&apos;s
                input.
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
                ) : canReorder ? (
                  <button
                    onClick={makeHero}
                    title="Use this input as the hero"
                    className="nodrag absolute left-1 top-1 rounded bg-black/60 px-1 text-[9px] text-amber-300 hover:bg-black/80"
                  >
                    ★ Set hero
                  </button>
                ) : null}
              </>
            )}
          </div>

          {dropActive && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-md border-2 border-dashed border-accent bg-accent/15 text-[11px] font-medium text-white">
              Add as input
            </div>
          )}
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
