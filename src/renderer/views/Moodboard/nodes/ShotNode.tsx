import { Handle, Position, type NodeProps } from '@xyflow/react'
import { mediaUrl } from '@shared/media'
import { useShotStore } from '../../../store/shotStore'
import { useAssetStore } from '../../../store/assetStore'
import { useUiStore } from '../../../store/uiStore'
import { NodeFrame } from './NodeFrame'

interface ShotNodeData extends Record<string, unknown> {
  shotId: string
}

/**
 * A shot on the canvas: input handle (left), output handle (right). Shows the shot's
 * name, a couple of input thumbnails, the hero output, and Link/Open Workflow.
 * Reads live shot data from the store by id (so it updates without node rebuilds).
 */
export function ShotNode({ id, data, selected }: NodeProps): React.JSX.Element {
  const { shotId } = data as ShotNodeData
  const shot = useShotStore((s) => s.shots.find((sh) => sh.id === shotId))
  const inputs = useShotStore((s) => s.inputsByShot[shotId]) ?? []
  const takes = useShotStore((s) => s.takesByShot[shotId]) ?? []
  const busy = useShotStore((s) => s.busyId === shotId)
  const linkShot = useShotStore((s) => s.linkShot)
  const assets = useAssetStore((s) => s.assets)
  const setMode = useUiStore((s) => s.setMode)
  const setLinkedWorkflow = useUiStore((s) => s.setLinkedWorkflow)
  const setActiveShot = useUiStore((s) => s.setActiveShot)

  const inputThumbs = inputs
    .map((i) => assets.find((a) => a.id === i.assetId))
    .filter((a): a is NonNullable<typeof a> => !!a)
  const hero = takes.find((t) => t.id === shot?.heroTakeId)
  const linked = !!shot?.comfyWorkflowName

  const onLink = async (): Promise<void> => {
    if (!shot) return
    const result = await linkShot(shot.id)
    setLinkedWorkflow(result?.comfyWorkflowName ?? shot.comfyWorkflowName)
    setActiveShot(shot.id)
    setMode('generate')
  }

  return (
    <>
      <Handle type="target" position={Position.Left} id="in" className="!h-3 !w-3 !bg-accent" />
      <NodeFrame id={id} selected={!!selected} minWidth={180} minHeight={150}>
        <div className="flex h-full w-full flex-col gap-1 p-1.5">
          <span className="flex items-center gap-1 truncate text-xs font-medium text-zinc-200">
            {linked && <span title="Linked to a ComfyUI workflow">🔗</span>}
            Shot {shot?.name ?? '—'}
          </span>

          <div className="flex flex-1 gap-1.5">
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="text-[9px] uppercase text-zinc-500">In</span>
              <div className="flex flex-wrap gap-1">
                {inputThumbs.slice(0, 3).map((a) => (
                  <Thumb key={a.id} url={mediaUrl(a.filePath)} kind={a.kind} />
                ))}
                {inputThumbs.length > 3 && (
                  <span className="text-[10px] text-zinc-500">+{inputThumbs.length - 3}</span>
                )}
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="text-[9px] uppercase text-zinc-500">Out</span>
              {hero ? (
                <Thumb url={mediaUrl(hero.filePath)} kind={hero.kind} big />
              ) : (
                <span className="text-[10px] text-zinc-600">none</span>
              )}
            </div>
          </div>

          <button
            onClick={() => void onLink()}
            disabled={busy}
            className="nodrag rounded border border-border py-0.5 text-[10px] font-medium text-zinc-200 hover:bg-surface disabled:opacity-40"
          >
            {busy ? '…' : linked ? 'Open Workflow' : 'Link Workflow'}
          </button>
        </div>
      </NodeFrame>
      <Handle type="source" position={Position.Right} id="out" className="!h-3 !w-3 !bg-accent" />
    </>
  )
}

function Thumb({
  url,
  kind,
  big,
}: {
  url: string
  kind: 'image' | 'video' | 'audio'
  big?: boolean
}): React.JSX.Element {
  const size = big ? 'h-12 w-full' : 'h-8 w-8'
  return (
    <div className={`overflow-hidden rounded border border-border bg-black/40 ${size}`}>
      {kind === 'image' && <img src={url} alt="" className="h-full w-full object-cover" />}
      {kind === 'video' && (
        <video src={url} muted preload="metadata" className="h-full w-full object-cover" />
      )}
      {kind === 'audio' && <span className="text-sm">🎵</span>}
    </div>
  )
}
