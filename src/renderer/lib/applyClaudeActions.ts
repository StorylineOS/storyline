/**
 * Applies a batch of Claude-proposed actions by calling the EXISTING frames/moodboard
 * IPC — Claude never mutates directly. Newly-created nodes are addressed by symbolic
 * refs; existing nodes by their real id (from the project board snapshot). We resolve a
 * ref/id to its live record so we can nest frames inside layers with correct relative
 * coordinates and edit existing nodes type-aware. Throws on the first failure (moodboard
 * undo can revert); refreshes the board + timeline at the end.
 */
import { describeAction, type ClaudeAction } from '@shared/claudeActions'
import type { MoodboardItem, MoodboardItemType, TextItemData } from '@shared/types'
import type { MoodboardItemPatch } from '@shared/ipc'
import { useFrameStore } from '../store/frameStore'
import { useMoodboardStore } from '../store/moodboardStore'
import { useUiStore } from '../store/uiStore'

const DEFAULT_TEXT: TextItemData = {
  text: '',
  fontSize: 18,
  bold: false,
  italic: false,
  underline: false,
  color: '#e4e4e7',
  align: 'left',
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
/** Pause between steps so applied actions appear one-by-one (a "live build" feel). */
const STEP_MS = 140

export async function applyClaudeActions(
  actions: ClaudeAction[],
  onStep?: (done: number, total: number, label: string | null) => void,
): Promise<void> {
  // Snapshot existing canvas items so we can resolve real ids, types, and geometry.
  const existing = new Map(useMoodboardStore.getState().items.map((i) => [i.id, i]))
  // Records of nodes created in this batch, keyed by BOTH symbolic ref and real id.
  const created = new Map<string, MoodboardItem>()

  const record = (ref: string): MoodboardItem | undefined => created.get(ref) ?? existing.get(ref)
  const idOf = (ref: string): string => record(ref)?.id ?? ref
  const typeOf = (ref: string): MoodboardItemType | undefined => record(ref)?.type
  const remember = (ref: string, item: MoodboardItem): void => {
    created.set(ref, item)
    created.set(item.id, item)
  }
  /** Absolute canvas position of an item (children store positions relative to a layer). */
  const absOf = (item: MoodboardItem): { x: number; y: number } => {
    if (!item.parentId) return { x: item.x, y: item.y }
    const parent = created.get(item.parentId) ?? existing.get(item.parentId)
    return parent ? { x: parent.x + item.x, y: parent.y + item.y } : { x: item.x, y: item.y }
  }

  // Occupied rectangles so newly-added top-level nodes don't land on existing ones.
  // Layers are containers (meant to overlap their children), so they're tracked
  // separately: solid nodes avoid solids; new layers avoid other layers.
  type Rect = { x: number; y: number; w: number; h: number }
  // Solid (non-layer) rects keyed by id so a moved node can exclude itself; layers are
  // containers and overlap their children by design, so they're tracked separately.
  const solidById = new Map<string, Rect>()
  const layers: Rect[] = []
  for (const it of existing.values()) {
    const p = absOf(it)
    const r = { x: p.x, y: p.y, w: it.width, h: it.height }
    if (it.type === 'layer') layers.push(r)
    else solidById.set(it.id, r)
  }
  const solidRects = (excludeId?: string): Rect[] =>
    [...solidById.entries()].filter(([id]) => id !== excludeId).map(([, r]) => r)
  const overlaps = (a: Rect, b: Rect, gap = 28): boolean =>
    a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y
  /** Find the nearest free slot at/after (x,y): jump past colliders, wrapping to new rows. */
  const freeSpot = (x: number, y: number, w: number, h: number, occ: Rect[]): Rect => {
    let px = x
    let py = y
    for (let i = 0; i < 400; i++) {
      const r = { x: px, y: py, w, h }
      const hit = occ.find((o) => overlaps(r, o))
      if (!hit) return r
      px = hit.x + hit.w + 28
      if (px - x > 2400) {
        px = x
        py += h + 28
      }
    }
    return { x: px, y: py, w, h }
  }

  const mb = window.inlineStudio.moodboard
  const unwrap = <T>(res: { ok: true; value: T } | { ok: false; error: string }): T => {
    if (!res.ok) throw new Error(res.error)
    return res.value
  }

  /** Drop a created frame/preview into a layer, with x/y treated as relative to it. */
  const placeInLayer = async (
    ref: string,
    item: MoodboardItem,
    layerRef: string | undefined,
    relX: number,
    relY: number,
  ): Promise<void> => {
    if (!layerRef) {
      remember(ref, item)
      return
    }
    const layerId = idOf(layerRef)
    const updated = unwrap(await mb.updateItem(item.id, { parentId: layerId, x: relX, y: relY }))
    remember(ref, updated)
  }

  for (let i = 0; i < actions.length; i++) {
    const a = actions[i]
    onStep?.(i, actions.length, describeAction(a))
    switch (a.kind) {
      case 'addFrame': {
        // Top-level frames avoid overlapping existing nodes; in-layer ones keep their
        // relative coords (the layer positions them).
        const s = a.layerRef
          ? { x: a.x, y: a.y, w: 220, h: 200 }
          : freeSpot(a.x, a.y, 220, 200, solidRects())
        const item = unwrap(
          a.fromAssetId
            ? await mb.addFrameFromAsset(a.fromAssetId, s.x, s.y)
            : await mb.addEmptyFrame(s.x, s.y),
        )
        await placeInLayer(a.ref, item, a.layerRef, a.x, a.y)
        if (!a.layerRef) solidById.set(item.id, s)
        if (a.name && item.frameId)
          unwrap(await window.inlineStudio.frames.rename(item.frameId, a.name))
        break
      }
      case 'addLayer': {
        const w = typeof a.width === 'number' ? a.width : 420
        const h = typeof a.height === 'number' ? a.height : 300
        const s = freeSpot(a.x, a.y, w, h, layers)
        const item = unwrap(await mb.addLayer(s.x, s.y))
        remember(
          a.ref,
          unwrap(
            await mb.updateItem(item.id, {
              data: { name: a.name, color: a.color ?? item.data.color },
              width: w,
              height: h,
            }),
          ),
        )
        layers.push(s)
        break
      }
      case 'addPreview': {
        const s = a.layerRef
          ? { x: a.x, y: a.y, w: 280, h: 220 }
          : freeSpot(a.x, a.y, 280, 220, solidRects())
        const item = unwrap(await mb.addPreview(s.x, s.y))
        await placeInLayer(a.ref, item, a.layerRef, a.x, a.y)
        if (!a.layerRef) solidById.set(item.id, s)
        break
      }
      case 'addText': {
        const s = freeSpot(a.x, a.y, 200, 60, solidRects())
        const item = unwrap(await mb.addText(s.x, s.y))
        const text: TextItemData = { ...(item.data.text ?? DEFAULT_TEXT), text: a.text }
        remember(a.ref, unwrap(await mb.updateItem(item.id, { data: { text } })))
        solidById.set(item.id, s)
        break
      }
      case 'editItem': {
        const target = record(a.itemRef)
        if (!target) throw new Error(`Unknown item "${a.itemRef}".`)
        const patch: MoodboardItemPatch = {}
        if (typeof a.width === 'number') patch.width = a.width
        if (typeof a.height === 'number') patch.height = a.height

        // Moving a top-level solid: keep it off the surrounding nodes (excluding itself).
        const moving = typeof a.x === 'number' || typeof a.y === 'number'
        if (moving && target.type !== 'layer' && !target.parentId) {
          const w = a.width ?? target.width
          const h = a.height ?? target.height
          const s = freeSpot(
            typeof a.x === 'number' ? a.x : target.x,
            typeof a.y === 'number' ? a.y : target.y,
            w,
            h,
            solidRects(target.id),
          )
          patch.x = s.x
          patch.y = s.y
          solidById.set(target.id, s)
        } else if (moving) {
          if (typeof a.x === 'number') patch.x = a.x
          if (typeof a.y === 'number') patch.y = a.y
        }

        if (target.type === 'layer' && (a.name !== undefined || a.color !== undefined)) {
          patch.data = {
            ...target.data,
            name: a.name ?? target.data.name,
            color: a.color ?? target.data.color,
          }
        } else if (target.type === 'text' && (a.text !== undefined || a.color !== undefined)) {
          const cur = target.data.text ?? DEFAULT_TEXT
          patch.data = { text: { ...cur, text: a.text ?? cur.text, color: a.color ?? cur.color } }
        }
        if (Object.keys(patch).length > 0)
          remember(a.itemRef, unwrap(await mb.updateItem(target.id, patch)))
        // Renaming a frame edits the Frame entity, not the node's data.
        if (target.type === 'frame' && a.name && target.frameId) {
          unwrap(await window.inlineStudio.frames.rename(target.frameId, a.name))
        }
        break
      }
      case 'connect': {
        const functional = typeOf(a.fromRef) === 'frame' && typeOf(a.toRef) === 'preview'
        unwrap(
          await mb.createConnector(
            idOf(a.fromRef),
            idOf(a.toRef),
            functional ? 'out' : null,
            functional ? 'in' : null,
          ),
        )
        break
      }
      case 'renameFrame': {
        unwrap(
          await window.inlineStudio.frames.rename(
            record(a.frameRef)?.frameId ?? a.frameRef,
            a.name,
          ),
        )
        break
      }
      case 'nestInLayer': {
        const item = record(a.itemRef)
        const layer = record(a.layerRef)
        if (!item || !layer) throw new Error('Could not resolve item/layer to nest.')
        const ia = absOf(item)
        const la = absOf(layer)
        remember(
          a.itemRef,
          unwrap(
            await mb.updateItem(item.id, { parentId: layer.id, x: ia.x - la.x, y: ia.y - la.y }),
          ),
        )
        break
      }
      case 'suggestWorkflow': {
        const fid = record(a.frameRef)?.frameId ?? a.frameRef
        // Link (seeds + uploads inputs) and push the starter graph into the saved file.
        const linked = unwrap(await window.inlineStudio.comfy.linkFrame(fid))
        if (a.starterGraph) {
          unwrap(await window.inlineStudio.comfy.saveLiveWorkflow(fid, a.starterGraph, a.guidance))
        }
        // Drive the UI to the Generate tab and open THIS frame's workflow live — the
        // embedded ComfyUI waits for init then loads the saved file (with the starter
        // graph), so the user doesn't have to open it manually.
        const ui = useUiStore.getState()
        ui.setActiveFrame(fid)
        ui.setMode('generate')
        if (linked.comfyWorkflowName) ui.setLinkedWorkflow(linked.comfyWorkflowName)
        break
      }
    }

    // Reflect this step on the canvas before the next, so actions appear one-by-one —
    // like someone building the board on your behalf.
    await Promise.all([useMoodboardStore.getState().load(), useFrameStore.getState().load()])
    if (i < actions.length - 1) await sleep(STEP_MS)
  }
  onStep?.(actions.length, actions.length, null)
}
