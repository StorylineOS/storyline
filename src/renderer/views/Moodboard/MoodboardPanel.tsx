import { useEffect, useMemo, useRef } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  ConnectionMode,
  SelectionMode,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useViewport,
  getNodesBounds,
  applyNodeChanges,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { mediaUrl } from '@shared/media'
import type { MoodboardItem, MoodboardConnector, TextItemData } from '@shared/types'
import { useMoodboardStore } from '../../store/moodboardStore'
import { useAssetStore } from '../../store/assetStore'
import { useFrameStore } from '../../store/frameStore'
import { useUiStore } from '../../store/uiStore'
import { useClaudeStore } from '../../store/claudeStore'
import { ClaudeLogo } from '../../components/ClaudeLogo'
import { getAssetDragIds, getFrameDragId } from '../../lib/dnd'
import { ImageNode } from './nodes/ImageNode'
import { VideoNode } from './nodes/VideoNode'
import { AudioNode } from './nodes/AudioNode'
import { TextNode } from './nodes/TextNode'
import { FrameNode } from './nodes/FrameNode'
import { PreviewNode } from './nodes/PreviewNode'
import { LayerNode } from './nodes/LayerNode'
import { DeletableEdge } from './edges/DeletableEdge'
import { SideMenu } from './SideMenu'
import { CanvasToolbar } from './CanvasToolbar'
import { FrameInspector } from './FrameInspector'

const nodeTypes: NodeTypes = {
  image: ImageNode,
  video: VideoNode,
  audio: AudioNode,
  text: TextNode,
  frame: FrameNode,
  preview: PreviewNode,
  layer: LayerNode,
}

const edgeTypes: EdgeTypes = {
  deletable: DeletableEdge,
}

// Visual frame-link colors by chain level: first hop (from a root frame) = light red,
// next hop a different color, and so on, cycling through the palette.
const LEVEL_COLORS = [
  '#fca5a5', // red-300
  '#fdba74', // orange-300
  '#fcd34d', // amber-300
  '#86efac', // green-300
  '#93c5fd', // blue-300
  '#d8b4fe', // purple-300
  '#f9a8d4', // pink-300
]

const isFunctionalConnector = (c: MoodboardConnector): boolean => {
  const s = (c.data?.sourceHandle as string | undefined) ?? 'out'
  const t = (c.data?.targetHandle as string | undefined) ?? 'in'
  return s === 'out' && t === 'in'
}

/**
 * Color each visual (frame↔frame) connector by its level: a connector's color is
 * the depth of its source node in the link graph (roots = depth 0 → level-1
 * links are all light red; their children's links the next color, etc.).
 */
function visualEdgeColors(connectors: MoodboardConnector[]): Map<string, string> {
  const visual = connectors.filter((c) => !isFunctionalConnector(c))
  const adj = new Map<string, string[]>()
  const targets = new Set<string>()
  const sources = new Set<string>()
  for (const c of visual) {
    if (!adj.has(c.fromItemId)) adj.set(c.fromItemId, [])
    adj.get(c.fromItemId)?.push(c.toItemId)
    targets.add(c.toItemId)
    sources.add(c.fromItemId)
  }
  const depth = new Map<string, number>()
  const queue: string[] = []
  const visit = (id: string, d: number): void => {
    if (depth.has(id)) return
    depth.set(id, d)
    queue.push(id)
  }
  // Roots = sources with no incoming visual link.
  for (const s of sources) if (!targets.has(s)) visit(s, 0)
  // All-cycle fallback so every link still gets a color.
  if (queue.length === 0) for (const s of sources) visit(s, 0)
  while (queue.length) {
    const n = queue.shift() as string
    const d = depth.get(n) ?? 0
    for (const t of adj.get(n) ?? []) visit(t, d + 1)
  }
  const colors = new Map<string, string>()
  for (const c of visual) {
    const d = depth.get(c.fromItemId) ?? 0
    colors.set(c.id, LEVEL_COLORS[d % LEVEL_COLORS.length])
  }
  return colors
}

const FALLBACK_TEXT: TextItemData = {
  text: '',
  fontSize: 18,
  bold: false,
  italic: false,
  underline: false,
  color: '#e4e4e7',
  align: 'left',
}

/** The unified node canvas ("Storyline"): frames, layers, previews, and ideation items. */
export function MoodboardPanel(): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <Board />
    </ReactFlowProvider>
  )
}

function Board(): React.JSX.Element {
  const { items, connectors, error, load, updateItem, deleteItem, connect, disconnect } =
    useMoodboardStore()
  const addTextAt = useMoodboardStore((s) => s.addTextAt)
  const addFrameFromAssetInLayer = useMoodboardStore((s) => s.addFrameFromAssetInLayer)
  const addFrameItemInLayer = useMoodboardStore((s) => s.addFrameItemInLayer)
  const addPreview = useMoodboardStore((s) => s.addPreview)
  const addLayer = useMoodboardStore((s) => s.addLayer)
  const addEmptyFrame = useMoodboardStore((s) => s.addEmptyFrame)
  const duplicateItems = useMoodboardStore((s) => s.duplicateItems)
  const undo = useMoodboardStore((s) => s.undo)
  const redo = useMoodboardStore((s) => s.redo)
  const addSourceInput = useFrameStore((s) => s.addSourceInput)
  const assets = useAssetStore((s) => s.assets)
  const loadAssets = useAssetStore((s) => s.load)
  const loadFrames = useFrameStore((s) => s.load)
  const setCanvasSelection = useUiStore((s) => s.setCanvasSelection)
  const setCanvasCenter = useUiStore((s) => s.setCanvasCenter)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, getNodes } = useReactFlow()
  const [nodes, setNodes] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  // In-memory clipboard for copy/paste; pasteCount cascades repeated pastes.
  const clipboard = useRef<MoodboardItem[]>([])
  const pasteCount = useRef(0)

  useEffect(() => {
    void load()
    void loadAssets()
    void loadFrames()
  }, [load, loadAssets, loadFrames])

  const assetsById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets])

  useEffect(() => {
    setNodes(toNodes(items, assetsById))
  }, [items, assetsById, setNodes])

  // Edges are managed by useEdgesState (so selection/hover changes apply via
  // onEdgesChange) but kept in sync with the persisted connectors.
  useEffect(() => {
    const levelColors = visualEdgeColors(connectors)
    setEdges(
      connectors.map((c) => {
        const sourceHandle = (c.data?.sourceHandle as string | undefined) ?? 'out'
        const targetHandle = (c.data?.targetHandle as string | undefined) ?? 'in'
        // The functional output→preview edge animates; visual frame links are static
        // and colored by their chain level.
        const functional = sourceHandle === 'out' && targetHandle === 'in'
        return {
          id: c.id,
          source: c.fromItemId,
          target: c.toItemId,
          sourceHandle,
          targetHandle,
          type: 'deletable',
          animated: functional,
          data: { functional, color: levelColors.get(c.id) },
        }
      }),
    )
  }, [connectors, setEdges])

  const onNodesChange = (changes: NodeChange<Node>[]): void => {
    setNodes((nds) => applyNodeChanges(changes, nds))
  }

  // Keyboard: copy (⌘/Ctrl-C), paste (⌘/Ctrl-V), undo (⌘/Ctrl-Z), redo (⌘/Ctrl-Shift-Z
  // or ⌘/Ctrl-Y). Delete is handled by React Flow's deleteKeyCode + onNodesDelete.
  // Ignored while editing text/inputs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.metaKey || e.ctrlKey)) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      const key = e.key.toLowerCase()

      if (key === 'z') {
        e.preventDefault()
        if (e.shiftKey) void redo()
        else void undo()
      } else if (key === 'y') {
        e.preventDefault()
        void redo()
      } else if (key === 'c') {
        const selectedIds = new Set(
          getNodes()
            .filter((n) => n.selected)
            .map((n) => n.id),
        )
        const picked = useMoodboardStore.getState().items.filter((it) => selectedIds.has(it.id))
        if (picked.length) {
          clipboard.current = picked
          pasteCount.current = 0
          e.preventDefault()
        }
      } else if (key === 'v') {
        if (clipboard.current.length === 0) return
        e.preventDefault()
        pasteCount.current += 1
        const shift = 32 * pasteCount.current
        void duplicateItems(clipboard.current, { x: shift, y: shift })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [getNodes, duplicateItems, undo, redo])

  const centre = (): { x: number; y: number } => {
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
  }

  /** The topmost layer whose rectangle contains an absolute flow point (or null). */
  const layerAt = (pos: { x: number; y: number }, exceptId?: string): MoodboardItem | null => {
    const hit = items
      .filter((it) => it.type === 'layer' && it.id !== exceptId)
      .filter(
        (l) => pos.x >= l.x && pos.x <= l.x + l.width && pos.y >= l.y && pos.y <= l.y + l.height,
      )
    return hit.length ? hit[hit.length - 1] : null
  }

  const onConnect = (c: Connection): void => {
    if (!c.source || !c.target || c.source === c.target) return
    void connect(c.source, c.target, c.sourceHandle ?? null, c.targetHandle ?? null)

    // Preview output → Frame input: also wire the data link. The frame takes the
    // preview's source frame (whoever feeds the preview) as a live input — resolved
    // to that frame's hero take at generate time.
    const src = items.find((it) => it.id === c.source)
    const tgt = items.find((it) => it.id === c.target)
    if (
      src?.type === 'preview' &&
      tgt?.type === 'frame' &&
      c.targetHandle === 'in' &&
      tgt.frameId
    ) {
      const feed = connectors.find((k) => k.toItemId === src.id)
      const sourceFrameId = feed
        ? items.find((it) => it.id === feed.fromItemId)?.frameId
        : undefined
      if (sourceFrameId) void addSourceInput(tgt.frameId, sourceFrameId)
    }
  }

  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    const drop = screenToFlowPosition({ x: e.clientX, y: e.clientY })

    // A frame dragged from the Timeline tab → place its node on the canvas (skip if
    // it's already placed, to avoid two nodes pointing at the same frame).
    const frameId = getFrameDragId(e.dataTransfer)
    if (frameId) {
      if (items.some((it) => it.type === 'frame' && it.frameId === frameId)) return
      const layer = layerAt(drop)
      const x = layer ? drop.x - layer.x : drop.x
      const y = layer ? drop.y - layer.y : drop.y
      void addFrameItemInLayer(frameId, x, y, layer?.id ?? null)
      return
    }

    const ids = getAssetDragIds(e.dataTransfer)
    if (ids.length === 0) return
    ids.forEach((assetId, i) => {
      const abs = { x: drop.x + i * 24, y: drop.y + i * 24 }
      const layer = layerAt(abs)
      // Children store positions relative to their layer.
      const x = layer ? abs.x - layer.x : abs.x
      const y = layer ? abs.y - layer.y : abs.y
      void addFrameFromAssetInLayer(assetId, x, y, layer?.id ?? null)
    })
  }

  /** On drag stop, persist position and (for frames/previews) re-parent into/out of a layer. */
  const onNodeDragStop = (_e: unknown, node: Node): void => {
    const item = items.find((it) => it.id === node.id)
    if (!item) return

    if (item.type !== 'frame' && item.type !== 'preview') {
      void updateItem(node.id, { x: node.position.x, y: node.position.y })
      return
    }

    const parent = item.parentId ? items.find((it) => it.id === item.parentId) : undefined
    const abs = parent
      ? { x: parent.x + node.position.x, y: parent.y + node.position.y }
      : { x: node.position.x, y: node.position.y }
    const target = layerAt(abs)
    const newParentId = target?.id ?? null

    if (newParentId !== item.parentId) {
      const x = target ? abs.x - target.x : abs.x
      const y = target ? abs.y - target.y : abs.y
      void updateItem(node.id, { parentId: newParentId, x, y })
    } else {
      void updateItem(node.id, { x: node.position.x, y: node.position.y })
    }
  }

  return (
    <div className="relative flex h-full">
      <SideMenu />

      <div ref={wrapperRef} className="relative flex-1 bg-panel">
        {error && (
          <div className="absolute left-2 top-2 z-10 rounded bg-red-950/80 px-2 py-1 text-xs text-red-300">
            {error}
          </div>
        )}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          deleteKeyCode={['Backspace', 'Delete']}
          // Figma/Miro multi-select: hold ⌘/Ctrl/Shift and drag to marquee, or
          // ⌘/Ctrl/Shift-click to add to the selection. Partial = touch to select.
          selectionKeyCode={['Meta', 'Control', 'Shift']}
          multiSelectionKeyCode={['Meta', 'Control', 'Shift']}
          selectionMode={SelectionMode.Partial}
          defaultEdgeOptions={{ interactionWidth: 20 }}
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
          }}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          onNodesDelete={(deleted) => deleted.forEach((n) => void deleteItem(n.id))}
          onConnect={onConnect}
          onEdgesDelete={(deleted) => deleted.forEach((e) => void disconnect(e.id))}
          // Mirror selection + viewport so the assistant can use them as context.
          onSelectionChange={({ nodes: sel }) => setCanvasSelection(sel.map((n) => n.id))}
          onMove={() => setCanvasCenter(centre())}
          onInit={() => setCanvasCenter(centre())}
          proOptions={{ hideAttribution: true }}
          minZoom={0.1}
          maxZoom={4}
          fitView
        >
          <Background gap={22} size={2.5} color="#525a66" />
        </ReactFlow>

        {items.length === 0 && <EmptyCanvasHint />}

        <SelectionActions />

        <CanvasToolbar
          onAddFrame={() => {
            const { x, y } = centre()
            void addEmptyFrame(x, y)
          }}
          onAddLayer={() => {
            const { x, y } = centre()
            void addLayer(x, y)
          }}
          onAddPreview={() => {
            const { x, y } = centre()
            void addPreview(x, y)
          }}
          onAddText={() => {
            const { x, y } = centre()
            void addTextAt(x, y)
          }}
        />
      </div>

      <FrameInspector />
    </div>
  )
}

/**
 * Floating "Add to Claude" action pinned to the top-right of the current selection.
 * Attaches the selected nodes as chat context and opens the assistant.
 */
function SelectionActions(): React.JSX.Element | null {
  const selection = useUiStore((s) => s.canvasSelection)
  const attachSelection = useClaudeStore((s) => s.attachSelection)
  const setAssistantOpen = useUiStore((s) => s.setAssistantOpen)
  const { getNodes } = useReactFlow()
  const { x, y, zoom } = useViewport()

  if (selection.length === 0) return null
  const nodes = getNodes().filter((n) => n.selected)
  if (nodes.length === 0) return null

  // Top-right corner of the selection bounds, in pane (wrapper) pixels.
  const b = getNodesBounds(nodes)
  const left = (b.x + b.width) * zoom + x
  const top = b.y * zoom + y

  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-20"
      style={{ transform: `translate(${left}px, ${top - 8}px)` }}
    >
      <button
        onClick={() => {
          attachSelection()
          setAssistantOpen(true)
        }}
        className="pointer-events-auto flex -translate-x-full -translate-y-full items-center gap-1 whitespace-nowrap rounded-md border border-[#D97757]/50 bg-panel px-2 py-1 text-[11px] font-medium text-zinc-100 shadow-lg hover:bg-surface"
      >
        <ClaudeLogo size={12} className="text-[#D97757]" />
        Add to Claude
      </button>
    </div>
  )
}

/** Centered hint shown over an empty canvas. Non-interactive so it never blocks drops. */
function EmptyCanvasHint(): React.JSX.Element {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div className="flex max-w-sm flex-col items-center gap-2 text-center">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-9 w-9 text-zinc-600"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-4.5-4.5L7 20" />
        </svg>
        <p className="text-sm font-medium text-zinc-300">Your canvas is empty</p>
        <p className="text-xs leading-relaxed text-zinc-500">
          Drag an asset from the Assets panel onto the canvas to create your first frame.
        </p>
      </div>
    </div>
  )
}

/** Map items to React Flow nodes — layers first so they precede their children. */
function toNodes(
  items: MoodboardItem[],
  assetsById: Map<string, { filePath: string; kind: string; name: string }>,
): Node[] {
  const ordered = [...items].sort(
    (a, b) => (a.type === 'layer' ? -1 : 0) - (b.type === 'layer' ? -1 : 0),
  )
  return ordered.map((item) => itemToNode(item, assetsById))
}

function itemToNode(
  item: MoodboardItem,
  assetsById: Map<string, { filePath: string; kind: string; name: string }>,
): Node {
  const common: Node = {
    id: item.id,
    position: { x: item.x, y: item.y },
    style: { width: item.width, height: item.height, zIndex: item.zIndex },
    data: {},
    ...(item.parentId ? { parentId: item.parentId } : {}),
  }
  if (item.type === 'layer') {
    return {
      ...common,
      type: 'layer',
      dragHandle: '.drag-handle',
      data: { name: item.data.name ?? 'Layer', color: item.data.color },
    }
  }
  if (item.type === 'frame') {
    return { ...common, type: 'frame', data: { frameId: item.frameId } }
  }
  if (item.type === 'preview') {
    return { ...common, type: 'preview', data: {} }
  }
  if (item.type === 'text') {
    return { ...common, type: 'text', data: { text: item.data.text ?? FALLBACK_TEXT } }
  }
  const asset = item.assetId ? assetsById.get(item.assetId) : undefined
  const src = asset ? mediaUrl(asset.filePath) : ''
  const type = asset?.kind === 'video' ? 'video' : asset?.kind === 'audio' ? 'audio' : 'image'
  return { ...common, type, data: { src, name: asset?.name ?? '' } }
}
