import { useState } from 'react'
import { mediaUrl } from '@shared/media'
import type { Frame } from '@shared/types'
import { useFrameStore } from '../../store/frameStore'
import { useAssetStore } from '../../store/assetStore'
import { useMoodboardStore } from '../../store/moodboardStore'
import { useUiStore } from '../../store/uiStore'
import { LibraryPanel } from '../Library/LibraryPanel'
import { setFrameDragPayload } from '../../lib/dnd'
import { EditIcon, FolderIcon, HistoryIcon, ImageIcon, WorkflowIcon } from '../../components/icons'

type Tab = 'assets' | 'timeline'
type SortKey = 'updated' | 'name'

const TABS: { key: Tab; label: string; Icon: (p: { className?: string }) => React.JSX.Element }[] =
  [
    { key: 'assets', label: 'Assets', Icon: ImageIcon },
    { key: 'timeline', label: 'Timeline', Icon: HistoryIcon },
  ]

/**
 * Collapsible left rail for the canvas. Assets reuses the full library (browse /
 * import / folders; drag a tile onto the canvas to create a frame). Timeline shows
 * each frame as a folder of Inputs / Outputs / Workflow, with delete + sort. Node
 * creation lives in the floating canvas toolbar instead.
 */
export function SideMenu(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('assets')
  const [open, setOpen] = useState(true)

  if (!open) {
    return (
      <div className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-border bg-panel py-2">
        <button
          onClick={() => setOpen(true)}
          title="Expand menu"
          className="mb-1 text-zinc-400 hover:text-white"
        >
          ▸
        </button>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key)
              setOpen(true)
            }}
            title={t.label}
            className={`flex h-9 w-9 items-center justify-center rounded ${
              tab === t.key ? 'bg-accent text-white' : 'text-zinc-400 hover:bg-surface'
            }`}
          >
            <t.Icon className="h-5 w-5" />
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex w-64 shrink-0 flex-col border-r border-border bg-panel">
      <div className="flex items-center justify-between border-b border-border px-1 py-1">
        <div className="flex gap-0.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              title={t.label}
              className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] ${
                tab === t.key ? 'bg-accent text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <t.Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setOpen(false)}
          title="Collapse menu"
          className="px-1 text-zinc-500 hover:text-white"
        >
          ◂
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {/* Assets reuses the full library panel — drag a tile onto the canvas to create a frame. */}
        {tab === 'assets' && <LibraryPanel />}
        {tab === 'timeline' && <TimelineTab />}
      </div>
    </div>
  )
}

function TimelineTab(): React.JSX.Element {
  const frames = useFrameStore((s) => s.frames)
  const removeFrame = useFrameStore((s) => s.remove)
  const reloadBoard = useMoodboardStore((s) => s.load)
  const [sort, setSort] = useState<SortKey>('updated')

  const sorted = [...frames].sort((a, b) =>
    sort === 'name'
      ? a.name.localeCompare(b.name, undefined, { numeric: true })
      : b.updatedAt - a.updatedAt,
  )

  const onDelete = async (frame: Frame): Promise<void> => {
    if (
      !window.confirm(
        `Delete Frame ${frame.name}? Its takes, workflow and canvas node are removed.`,
      )
    )
      return
    await removeFrame(frame.id)
    void reloadBoard() // drop the (now-deleted) canvas node
  }

  if (frames.length === 0) {
    return (
      <p className="p-2 text-xs text-zinc-600">No frames yet — drag an asset onto the canvas.</p>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">
          {frames.length} frame{frames.length === 1 ? '' : 's'}
        </span>
        <label className="flex items-center gap-1 text-[10px] text-zinc-500">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded border border-border bg-surface px-1 py-0.5 text-[10px] text-zinc-300 outline-none"
          >
            <option value="updated">Last updated</option>
            <option value="name">Name A–Z</option>
          </select>
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="flex flex-col gap-1">
          {sorted.map((frame) => (
            <FrameFolder key={frame.id} frame={frame} onDelete={() => void onDelete(frame)} />
          ))}
        </div>
      </div>
    </div>
  )
}

function FrameFolder({
  frame,
  onDelete,
}: {
  frame: Frame
  onDelete: () => void
}): React.JSX.Element {
  const inputs = useFrameStore((s) => s.inputsByFrame[frame.id]) ?? []
  const takes = useFrameStore((s) => s.takesByFrame[frame.id]) ?? []
  const assets = useAssetStore((s) => s.assets)
  const openInspector = useUiStore((s) => s.setInspectorFrame)
  const [open, setOpen] = useState(false)

  const inputAssets = inputs
    .map((i) => assets.find((a) => a.id === i.assetId))
    .filter((a): a is NonNullable<typeof a> => !!a)
  const workflowFile = frame.comfyWorkflowName
    ? `${frame.comfyWorkflowName.split('/').pop()}.json`
    : null

  return (
    <div className="overflow-hidden rounded border border-border">
      <div
        draggable
        onDragStart={(e) => setFrameDragPayload(e.dataTransfer, frame.id)}
        title="Drag onto the canvas to place this frame"
        className="flex cursor-grab items-center gap-1 bg-surface px-1.5 py-1 active:cursor-grabbing"
      >
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-1 text-left"
          title="Toggle"
        >
          <span className="text-zinc-500">{open ? '▾' : '▸'}</span>
          <FolderIcon className="h-3 w-3 shrink-0 text-zinc-500" />
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-200">
            Frame {frame.name}
          </span>
        </button>
        {frame.comfyWorkflowName && (
          <span title="Linked workflow" className="flex shrink-0 text-zinc-400">
            <WorkflowIcon className="h-3.5 w-3.5" />
          </span>
        )}
        <button
          onClick={() => openInspector(frame.id)}
          title="Edit frame"
          className="px-1 text-zinc-400 hover:text-white"
        >
          <EditIcon className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDelete}
          title="Delete frame"
          className="px-1 text-[11px] text-zinc-400 hover:text-red-400"
        >
          ✕
        </button>
      </div>

      {open && (
        <div className="border-t border-border py-1 pl-2 pr-1.5">
          <Folder label="Inputs" count={inputAssets.length}>
            {inputAssets.length === 0 ? (
              <Empty>none</Empty>
            ) : (
              inputAssets.map((a) => (
                <FileRow key={a.id} name={a.name} thumb={mediaUrl(a.filePath)} kind={a.kind} />
              ))
            )}
          </Folder>

          <Folder label="Outputs" count={takes.length}>
            {takes.length === 0 ? (
              <Empty>none</Empty>
            ) : (
              takes.map((t) => (
                <FileRow
                  key={t.id}
                  name={t.filePath.split('/').pop() ?? 'take'}
                  thumb={mediaUrl(t.filePath)}
                  kind={t.kind}
                  badge={t.id === frame.heroTakeId ? '★' : undefined}
                />
              ))
            )}
          </Folder>

          <Folder label="Workflow" count={workflowFile ? 1 : 0}>
            {workflowFile ? (
              <div className="flex items-center gap-1 py-0.5 text-[11px] text-zinc-300">
                <span className="text-zinc-500">{'{ }'}</span>
                <span className="min-w-0 flex-1 truncate" title={frame.comfyWorkflowName ?? ''}>
                  {workflowFile}
                </span>
                <span className="text-[9px] text-zinc-600">saved</span>
              </div>
            ) : (
              <Empty>open the frame to create it</Empty>
            )}
          </Folder>
        </div>
      )}
    </div>
  )
}

function Folder({
  label,
  count,
  children,
}: {
  label: string
  count: number
  children: React.ReactNode
}): React.JSX.Element {
  const [open, setOpen] = useState(true)
  return (
    <div className="flex flex-col">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 py-0.5 text-left text-[10px] uppercase tracking-wide text-zinc-500 hover:text-zinc-300"
      >
        <span>{open ? '▾' : '▸'}</span>
        <FolderIcon className="h-3 w-3 shrink-0 text-zinc-500" />
        {label}
        <span className="text-zinc-600">({count})</span>
      </button>
      {open && <div className="flex flex-col gap-0.5 pb-1 pl-3">{children}</div>}
    </div>
  )
}

function FileRow({
  name,
  thumb,
  kind,
  badge,
}: {
  name: string
  thumb: string
  kind: 'image' | 'video' | 'audio'
  badge?: string
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <div className="h-7 w-7 shrink-0 overflow-hidden rounded border border-border bg-black/40">
        {kind === 'image' && <img src={thumb} alt="" className="h-full w-full object-cover" />}
        {kind === 'video' && (
          <video src={thumb} muted preload="metadata" className="h-full w-full object-cover" />
        )}
        {kind === 'audio' && (
          <span className="flex h-full w-full items-center justify-center text-xs">🎵</span>
        )}
      </div>
      <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-400" title={name}>
        {name}
      </span>
      {badge && <span className="text-[10px] text-amber-300">{badge}</span>}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <span className="py-0.5 text-[10px] text-zinc-600">{children}</span>
}
