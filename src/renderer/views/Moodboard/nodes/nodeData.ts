import type { TextItemData } from '@shared/types'

/** Data carried by an asset node (image/video/audio). */
export interface AssetNodeData extends Record<string, unknown> {
  src: string
  name: string
  /** Waveform peaks JSON URL, for audio assets. */
  waveform?: string
}

/** Data carried by a text node. */
export interface TextNodeData extends Record<string, unknown> {
  text: TextItemData
}

/** Data carried by a director node. */
export interface DirectorNodeData extends Record<string, unknown> {
  name: string
  /** Project-relative path of the built proxy preview MP4, if any. */
  previewUrl?: string
}
