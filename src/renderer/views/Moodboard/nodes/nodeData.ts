import type { TextItemData } from '@shared/types'

/** Data carried by an asset node (image/video/audio). */
export interface AssetNodeData extends Record<string, unknown> {
  src: string
  name: string
}

/** Data carried by a text node. */
export interface TextNodeData extends Record<string, unknown> {
  text: TextItemData
}
