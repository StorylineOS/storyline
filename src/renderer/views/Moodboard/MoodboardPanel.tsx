import { useEffect, useMemo, useRef } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  ConnectionMode,
  useNodesState,
  useEdgesState,
  useReactFlow,
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
import type { MoodboardItem, TextItemData } from '@shared/types'
import { useMoodboardStore } from '../../store/moodboardStore'
import { useAssetStore } from '../../store/assetStore'
import { useShotStore } from '../../store/shotStore'
import { getAssetDragIds } from '../../lib/dnd'
import { ImageNode } from './nodes/ImageNode'
import { VideoNode } from './nodes/VideoNode'
import { AudioNode } from './nodes/AudioNode'
import { TextNode } from './nodes/TextNode'
import { ShotNode } from './nodes/ShotNode'
import { PreviewNode } from './nodes/PreviewNode'
import { LayerNode } from './nodes/LayerNode'
import { DeletableEdge } from './edges/DeletableEdge'
import { SideMenu } from './SideMenu'

const nodeTypes: NodeTypes = {
  image: ImageNode,
  video: VideoNode,
  audio: AudioNode,
  text: TextNode,
  shot: ShotNode,
  preview: PreviewNode,
  layer: LayerNode,
}

const edgeTypes: EdgeTypes = {
  deletable: DeletableEdge,
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

/** The unified node canvas ("Storyline"): shots, layers, previews, and ideation items. */
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
  const addShotItem = useMoodboardStore((s) => s.addShotItem)
  const addShotFromAssetInLayer = useMoodboardStore((s) => s.addShotFromAssetInLayer)
  const addPreview = useMoodboardStore((s) => s.addPreview)
  const addLayer = useMoodboardStore((s) => s.addLayer)
  const assets = useAssetStore((s) => s.assets)
  const loadAssets = useAssetStore((s) => s.load)
  const loadShots = useShotStore((s) => s.load)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()
  const [nodes, setNodes] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  useEffect(() => {
    void load()
    void loadAssets()
    void loadShots()
  }, [load, loadAssets, loadShots])

  const assetsById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets])

  useEffect(() => {
    setNodes(toNodes(items, assetsById))
  }, [items, assetsById, setNodes])

  // Edges are managed by useEdgesState (so selection/hover changes apply via
  // onEdgesChange) but kept in sync with the persisted connectors.
  useEffect(() => {
    setEdges(
      connectors.map((c) => {
        const sourceHandle = (c.data?.sourceHandle as string | undefined) ?? 'out'
        const targetHandle = (c.data?.targetHandle as string | undefined) ?? 'in'
        // The functional output→preview edge animates; visual shot links are static.
        const functional = sourceHandle === 'out' && targetHandle === 'in'
        return {
          id: c.id,
          source: c.fromItemId,
          target: c.toItemId,
          sourceHandle,
          targetHandle,
          type: 'deletable',
          animated: functional,
          data: { functional },
        }
      }),
    )
  }, [connectors, setEdges])

  const onNodesChange = (changes: NodeChange<Node>[]): void => {
    setNodes((nds) => applyNodeChanges(changes, nds))
  }

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
    if (c.source && c.target && c.source !== c.target)
      void connect(c.source, c.target, c.sourceHandle ?? null, c.targetHandle ?? null)
  }

  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    const ids = getAssetDragIds(e.dataTransfer)
    if (ids.length === 0) return
    const drop = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    ids.forEach((assetId, i) => {
      const abs = { x: drop.x + i * 24, y: drop.y + i * 24 }
      const layer = layerAt(abs)
      // Children store positions relative to their layer.
      const x = layer ? abs.x - layer.x : abs.x
      const y = layer ? abs.y - layer.y : abs.y
      void addShotFromAssetInLayer(assetId, x, y, layer?.id ?? null)
    })
  }

  /** On drag stop, persist position and (for shots/previews) re-parent into/out of a layer. */
  const onNodeDragStop = (_e: unknown, node: Node): void => {
    const item = items.find((it) => it.id === node.id)
    if (!item) return

    if (item.type !== 'shot' && item.type !== 'preview') {
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
    <div className="flex h-full">
      <SideMenu
        onAddShot={(shotId) => {
          const { x, y } = centre()
          void addShotItem(shotId, x, y)
        }}
        onAddPreview={() => {
          const { x, y } = centre()
          void addPreview(x, y)
        }}
        onAddText={() => {
          const { x, y } = centre()
          void addTextAt(x, y)
        }}
        onAddLayer={() => {
          const { x, y } = centre()
          void addLayer(x, y)
        }}
      />

      <div ref={wrapperRef} className="relative flex-1">
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
          proOptions={{ hideAttribution: true }}
          minZoom={0.1}
          maxZoom={4}
          fitView
        >
          <Background gap={22} size={2.5} color="#525a66" />
          <Controls showInteractive={false} />
        </ReactFlow>
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
      data: { name: item.data.name ?? 'Layer' },
    }
  }
  if (item.type === 'shot') {
    return { ...common, type: 'shot', data: { shotId: item.shotId } }
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
