import { useEffect, useMemo, useRef } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useNodesState,
  useReactFlow,
  applyNodeChanges,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { mediaUrl } from '@shared/media'
import type { MoodboardItem, TextItemData } from '@shared/types'
import { useMoodboardStore } from '../../store/moodboardStore'
import { useAssetStore } from '../../store/assetStore'
import { useShotStore } from '../../store/shotStore'
import { ImageNode } from './nodes/ImageNode'
import { VideoNode } from './nodes/VideoNode'
import { AudioNode } from './nodes/AudioNode'
import { TextNode } from './nodes/TextNode'
import { ShotNode } from './nodes/ShotNode'
import { PreviewNode } from './nodes/PreviewNode'
import { SideMenu } from './SideMenu'

const nodeTypes: NodeTypes = {
  image: ImageNode,
  video: VideoNode,
  audio: AudioNode,
  text: TextNode,
  shot: ShotNode,
  preview: PreviewNode,
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

/** The unified node canvas ("Sequence"): shots, previews, and ideation items. */
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
  const addShotFromAsset = useMoodboardStore((s) => s.addShotFromAsset)
  const addShotItem = useMoodboardStore((s) => s.addShotItem)
  const addPreview = useMoodboardStore((s) => s.addPreview)
  const importAndPlace = useMoodboardStore((s) => s.importAndPlace)
  const assets = useAssetStore((s) => s.assets)
  const loadAssets = useAssetStore((s) => s.load)
  const loadShots = useShotStore((s) => s.load)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()
  const [nodes, setNodes] = useNodesState<Node>([])

  useEffect(() => {
    void load()
    void loadAssets()
    void loadShots()
  }, [load, loadAssets, loadShots])

  const assetsById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets])

  useEffect(() => {
    setNodes(items.map((item) => itemToNode(item, assetsById)))
  }, [items, assetsById, setNodes])

  const edges: Edge[] = useMemo(
    () =>
      connectors.map((c) => ({
        id: c.id,
        source: c.fromItemId,
        target: c.toItemId,
        sourceHandle: 'out',
        targetHandle: 'in',
        animated: true,
        style: { stroke: '#6366f1' },
      })),
    [connectors],
  )

  const onNodesChange = (changes: NodeChange<Node>[]): void => {
    setNodes((nds) => applyNodeChanges(changes, nds))
  }

  const centre = (): { x: number; y: number } => {
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
  }

  const onImport = async (): Promise<void> => {
    const { x, y } = centre()
    const placed = await importAndPlace(x, y)
    if (placed.length > 0) void loadAssets()
  }

  const onConnect = (c: Connection): void => {
    if (c.source && c.target && c.source !== c.target) void connect(c.source, c.target)
  }

  return (
    <div className="flex h-full">
      <SideMenu
        onAddShotFromAsset={(assetId) => {
          const { x, y } = centre()
          void addShotFromAsset(assetId, x, y)
        }}
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
        onImport={() => void onImport()}
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
          onNodesChange={onNodesChange}
          onNodeDragStop={(_e, node) =>
            void updateItem(node.id, { x: node.position.x, y: node.position.y })
          }
          onNodesDelete={(deleted) => deleted.forEach((n) => void deleteItem(n.id))}
          onConnect={onConnect}
          onEdgesDelete={(deleted) => deleted.forEach((e) => void disconnect(e.id))}
          proOptions={{ hideAttribution: true }}
          minZoom={0.1}
          maxZoom={4}
          fitView
        >
          <Background gap={20} color="#2a2d34" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  )
}

function itemToNode(
  item: MoodboardItem,
  assetsById: Map<string, { filePath: string; kind: string; name: string }>,
): Node {
  const common = {
    id: item.id,
    position: { x: item.x, y: item.y },
    style: { width: item.width, height: item.height, zIndex: item.zIndex },
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
