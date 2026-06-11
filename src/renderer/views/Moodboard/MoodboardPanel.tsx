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
  type NodeChange,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { mediaUrl } from '@shared/media'
import type { MoodboardItem, TextItemData } from '@shared/types'
import { useMoodboardStore } from '../../store/moodboardStore'
import { useAssetStore } from '../../store/assetStore'
import { ImageNode } from './nodes/ImageNode'
import { VideoNode } from './nodes/VideoNode'
import { AudioNode } from './nodes/AudioNode'
import { TextNode } from './nodes/TextNode'
import { LibraryStrip } from './LibraryStrip'

const nodeTypes: NodeTypes = {
  image: ImageNode,
  video: VideoNode,
  audio: AudioNode,
  text: TextNode,
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

/** Moodboard mode: a Figma/Miro-style infinite canvas backed by the shared library. */
export function MoodboardPanel(): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <Board />
    </ReactFlowProvider>
  )
}

function Board(): React.JSX.Element {
  const { items, error, load, updateItem, addTextAt, addAssetAt, importAndPlace } =
    useMoodboardStore()
  const assets = useAssetStore((s) => s.assets)
  const loadAssets = useAssetStore((s) => s.load)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()
  const [nodes, setNodes] = useNodesState<Node>([])

  useEffect(() => {
    void load()
    void loadAssets()
  }, [load, loadAssets])

  // Resolve assets so asset items can render their media.
  const assetsById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets])

  // Rebuild canvas nodes whenever the persisted items or asset library change.
  useEffect(() => {
    setNodes(items.map((item) => itemToNode(item, assetsById)))
  }, [items, assetsById, setNodes])

  const onNodesChange = (changes: NodeChange<Node>[]): void => {
    setNodes((nds) => applyNodeChanges(changes, nds))
  }

  /** A flow-space point at the centre of the visible canvas, for placing new items. */
  const centre = (): { x: number; y: number } => {
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
  }

  const onImport = async (): Promise<void> => {
    const { x, y } = centre()
    const placed = await importAndPlace(x, y)
    if (placed.length > 0) void loadAssets() // shared library changed
  }

  return (
    <div className="flex h-full">
      <LibraryStrip
        onAddAsset={(assetId) => {
          const { x, y } = centre()
          void addAssetAt(assetId, x, y)
        }}
        onImport={() => void onImport()}
        onAddText={() => {
          const { x, y } = centre()
          void addTextAt(x, y)
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
          edges={[]}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStop={(_e, node) =>
            void updateItem(node.id, { x: node.position.x, y: node.position.y })
          }
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
  if (item.type === 'text') {
    return { ...common, type: 'text', data: { text: item.data.text ?? FALLBACK_TEXT } }
  }
  const asset = item.assetId ? assetsById.get(item.assetId) : undefined
  const src = asset ? mediaUrl(asset.filePath) : ''
  const type = asset?.kind === 'video' ? 'video' : asset?.kind === 'audio' ? 'audio' : 'image'
  return { ...common, type, data: { src, name: asset?.name ?? '' } }
}
