/**
 * The vocabulary of actions Claude may PROPOSE to the user. These are not executed by
 * the model — the main loop records them and the renderer applies them (on the user's
 * approval) via the existing frames/moodboard IPC. Newly-created entities are addressed
 * by a symbolic `ref` the model assigns; later actions reference it (or a real id), and
 * the renderer resolves `ref → real id` as it applies the list in order.
 */

/** Create a frame and place it on the canvas. `ref` names the new frame/node. */
export interface AddFrameAction {
  kind: 'addFrame'
  ref: string
  /** Optional rename (defaults to the auto-assigned number). */
  name?: string
  /** Seed the frame from an existing library asset id (from the project context). */
  fromAssetId?: string
  /** Place inside this layer (ref or real id). Then x/y are RELATIVE to the layer. */
  layerRef?: string
  x: number
  y: number
}

/** Add a named, colored layer group container. `ref` names the new layer node. */
export interface AddLayerAction {
  kind: 'addLayer'
  ref: string
  name: string
  /** Hex color, e.g. "#60a5fa". */
  color?: string
  x: number
  y: number
  width?: number
  height?: number
}

/** Add a preview node (shows a connected frame's output). `ref` names the new node. */
export interface AddPreviewAction {
  kind: 'addPreview'
  ref: string
  /** Place inside this layer (ref or real id). Then x/y are RELATIVE to the layer. */
  layerRef?: string
  x: number
  y: number
}

/** Add a text note to the canvas. `ref` names the new node. */
export interface AddTextAction {
  kind: 'addText'
  ref: string
  text: string
  x: number
  y: number
}

/**
 * Edit an EXISTING node (or one created earlier in this batch). Only the provided
 * fields change. `itemRef` resolves to a node created above, or a real canvas item id
 * from the project board. `name` renames a frame or relabels a layer; `color` recolors a
 * layer or text; `text` sets a text node's content; x/y/width/height move/resize it.
 */
export interface EditItemAction {
  kind: 'editItem'
  itemRef: string
  x?: number
  y?: number
  width?: number
  height?: number
  name?: string
  color?: string
  text?: string
}

/** Connect two canvas nodes with an arrow. Refs resolve to nodes created above or real ids. */
export interface ConnectAction {
  kind: 'connect'
  fromRef: string
  toRef: string
}

/** Rename a frame. `frameRef` resolves to a frame created above, or a real frame id. */
export interface RenameFrameAction {
  kind: 'renameFrame'
  frameRef: string
  name: string
}

/** Move a node inside a layer group. Both refs resolve to nodes above or real ids. */
export interface NestInLayerAction {
  kind: 'nestInLayer'
  itemRef: string
  layerRef: string
}

/**
 * Set up a frame's ComfyUI workflow: link it (seeds if needed) and, when provided, seed
 * a starter graph. `guidance` is the human explanation of the node setup (also in chat).
 * Requires ComfyUI to be reachable. `frameRef` resolves to a frame above or a real id.
 */
export interface SuggestWorkflowAction {
  kind: 'suggestWorkflow'
  frameRef: string
  guidance?: string
  /** A ComfyUI workflow graph (litegraph JSON with a `nodes` array) to seed. */
  starterGraph?: Record<string, unknown>
}

export type ClaudeAction =
  | AddFrameAction
  | AddLayerAction
  | AddPreviewAction
  | AddTextAction
  | EditItemAction
  | ConnectAction
  | RenameFrameAction
  | NestInLayerAction
  | SuggestWorkflowAction

export type ClaudeActionKind = ClaudeAction['kind']

/** A batch of proposed actions surfaced to the user for one-click apply. */
export interface ClaudeProposal {
  /** Unique id, used by the UI to track apply/dismiss. */
  id: string
  /** The turn that produced it. */
  turnId: string
  /** One or two sentences describing the plan, for the user. */
  summary: string
  actions: ClaudeAction[]
}

/** A short human label for an action — used in proposal cards and the live "working" status. */
export function describeAction(a: ClaudeAction): string {
  switch (a.kind) {
    case 'addFrame':
      return `Adding frame${a.name ? ` "${a.name}"` : ''}${a.layerRef ? ' in layer' : ''}`
    case 'addLayer':
      return `Adding layer "${a.name}"`
    case 'addPreview':
      return `Adding preview${a.layerRef ? ' in layer' : ''}`
    case 'addText':
      return `Adding text "${a.text.slice(0, 24)}"`
    case 'editItem':
      return `Editing ${a.itemRef}`
    case 'connect':
      return `Connecting ${a.fromRef} → ${a.toRef}`
    case 'renameFrame':
      return `Renaming frame to "${a.name}"`
    case 'nestInLayer':
      return `Grouping ${a.itemRef} into ${a.layerRef}`
    case 'suggestWorkflow':
      return `Opening workflow in ComfyUI${a.starterGraph ? ' + starter graph' : ''}`
  }
}
