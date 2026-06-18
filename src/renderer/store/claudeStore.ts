/** Claude assistant state: connection/auth + a streaming chat turn. */
import { create } from 'zustand'
import type {
  ClaudeStatus,
  ClaudeMessage,
  ClaudeContext,
  ClaudeContextAttachment,
  MoodboardItem,
} from '@shared/types'
import type { ClaudeProposal } from '@shared/claudeActions'
import { DEFAULT_CLAUDE_MODEL, resolveModel } from '@shared/claudeModels'
import { ipcErrorMessage } from '../lib/ipcError'
import { applyClaudeActions } from '../lib/applyClaudeActions'
import { useUiStore } from './uiStore'
import { useFrameStore } from './frameStore'
import { useMoodboardStore } from './moodboardStore'
import { useAssetStore } from './assetStore'

/** A user-attached context chip (selected canvas items, or an empty-space spot). */
export interface ClaudeAttachment {
  id: string
  kind: 'items' | 'spot'
  ids?: string[]
  x?: number
  y?: number
  /** Chip text shown in the UI. */
  label: string
}

interface ClaudeState {
  status: ClaudeStatus | null
  /** Whether the renderer has wired up the streamed-event listeners yet. */
  initialized: boolean
  messages: ClaudeMessage[]
  /** The in-progress assistant message text, or null when not streaming. */
  streamingText: string | null
  /** Pending proposals awaiting the user's apply/dismiss. */
  proposals: ClaudeProposal[]
  /** The proposal currently being applied, if any. */
  applyingId: string | null
  /** Live progress while applying, so the UI reads like work being done step-by-step. */
  applyProgress: { done: number; total: number; label: string | null } | null
  /** A turn is in flight. */
  sending: boolean
  /** The id of the in-flight turn, used to ignore stale events. */
  turnId: string | null
  /** The chosen model id for the next turn. */
  model: string
  /** User-attached context chips for the next message(s). */
  attachments: ClaudeAttachment[]
  busy: boolean
  error: string | null
  loadStatus: () => Promise<void>
  setApiKey: (key: string) => Promise<boolean>
  clearApiKey: () => Promise<void>
  setModel: (id: string) => void
  init: () => void
  send: (prompt: string) => Promise<void>
  cancel: () => void
  applyProposal: (id: string) => Promise<void>
  dismissProposal: (id: string) => void
  /** Attach the current canvas selection as context (no-op if nothing selected). */
  attachSelection: () => void
  /** Attach the current canvas viewport center as a "place new items here" spot. */
  attachSpot: () => void
  removeAttachment: (id: string) => void
  clearChat: () => void
}

/** Persist the chosen model across sessions (validated against the known models on load). */
const MODEL_KEY = 'inlineStudio.claudeModel'
function loadModel(): string {
  try {
    const saved = localStorage.getItem(MODEL_KEY)
    if (saved) return resolveModel(saved).id
  } catch {
    // ignore unavailable storage
  }
  return DEFAULT_CLAUDE_MODEL
}

/** A human-readable name for a canvas item (frame name / layer label / text snippet / asset). */
function itemDisplayName(
  i: MoodboardItem,
  frameName: Map<string, string>,
  assetName: Map<string, string>,
): string {
  if (i.type === 'frame') return i.frameId ? (frameName.get(i.frameId) ?? 'Frame') : 'Frame'
  if (i.type === 'layer') return i.data.name ?? 'Layer'
  if (i.type === 'preview') return 'Preview'
  if (i.type === 'text') return (i.data.text?.text ?? '').slice(0, 40) || 'Text'
  return i.assetId ? (assetName.get(i.assetId) ?? 'Asset') : 'Asset'
}

/** Build the frame-id→name and asset-id→name lookups used for canvas labels. */
function nameMaps(): { frameName: Map<string, string>; assetName: Map<string, string> } {
  const { frames } = useFrameStore.getState()
  const { assets } = useAssetStore.getState()
  return {
    frameName: new Map(frames.map((f) => [f.id, f.name])),
    assetName: new Map(assets.map((a) => [a.id, a.name])),
  }
}

/** Gather a compact snapshot of the open project so Claude grounds its suggestions. */
async function buildContext(attachments: ClaudeContextAttachment[]): Promise<ClaudeContext> {
  const ui = useUiStore.getState()
  const { frames, inputsByFrame, takesByFrame } = useFrameStore.getState()
  const { items } = useMoodboardStore.getState()
  const { assets } = useAssetStore.getState()

  let comfyReachable = false
  try {
    const res = await window.inlineStudio.comfy.status()
    comfyReachable = res.ok && res.value.running
  } catch {
    comfyReachable = false
  }

  const focusId = ui.inspectorFrameId ?? ui.activeFrameId
  const focus = focusId ? frames.find((f) => f.id === focusId) : undefined
  const activeFrame = focus
    ? {
        id: focus.id,
        name: focus.name,
        inputCount: inputsByFrame[focus.id]?.length ?? 0,
        takeCount: takesByFrame[focus.id]?.length ?? 0,
        workflowReady: focus.comfyWorkflowReady,
      }
    : null

  const { frameName, assetName } = nameMaps()

  return {
    mode: ui.mode,
    comfyReachable,
    activeFrame,
    attachments,
    // Layers first so the model reads containers before their children. Cap for size.
    board: [...items]
      .sort((a, b) => (a.type === 'layer' ? 0 : 1) - (b.type === 'layer' ? 0 : 1))
      .slice(0, 80)
      .map((i) => ({
        id: i.id,
        type: i.type,
        name: itemDisplayName(i, frameName, assetName),
        x: Math.round(i.x),
        y: Math.round(i.y),
        width: Math.round(i.width),
        height: Math.round(i.height),
        parentId: i.parentId,
      })),
    frames: frames.map((f) => ({ id: f.id, name: f.name, kind: f.kind })),
    assets: assets.map((a) => ({ id: a.id, name: a.name, kind: a.kind })),
  }
}

export const useClaudeStore = create<ClaudeState>((set, get) => ({
  status: null,
  initialized: false,
  messages: [],
  streamingText: null,
  proposals: [],
  applyingId: null,
  applyProgress: null,
  sending: false,
  turnId: null,
  model: loadModel(),
  attachments: [],
  busy: false,
  error: null,

  loadStatus: async () => {
    try {
      const res = await window.inlineStudio.claude.status()
      if (res.ok) set({ status: res.value })
    } catch (e) {
      set({ error: ipcErrorMessage(e) })
    }
  },

  setApiKey: async (key) => {
    set({ busy: true, error: null })
    try {
      const res = await window.inlineStudio.claude.setApiKey(key)
      if (!res.ok) {
        set({ error: res.error, busy: false })
        return false
      }
      set({ status: res.value, busy: false })
      return true
    } catch (e) {
      set({ error: ipcErrorMessage(e), busy: false })
      return false
    }
  },

  clearApiKey: async () => {
    try {
      const res = await window.inlineStudio.claude.clearApiKey()
      if (res.ok) set({ status: res.value, error: null })
    } catch (e) {
      set({ error: ipcErrorMessage(e) })
    }
  },

  setModel: (id) => {
    try {
      localStorage.setItem(MODEL_KEY, id)
    } catch {
      // ignore unavailable storage
    }
    set({ model: id })
  },

  init: () => {
    if (get().initialized) return
    set({ initialized: true })
    window.inlineStudio.events.onClaudeDelta((e) => {
      if (e.turnId !== get().turnId) return
      set((s) => ({ streamingText: (s.streamingText ?? '') + e.text }))
    })
    window.inlineStudio.events.onClaudeProposal((p) => {
      set((s) => ({ proposals: [...s.proposals, p] }))
    })
    window.inlineStudio.events.onClaudeDone((e) => {
      if (e.turnId !== get().turnId) return
      // Prefer the authoritative full text from main over the live-accumulated deltas,
      // so a dropped/late delta can't leave the committed message truncated.
      const text = e.text || (get().streamingText ?? '')
      set((s) => ({
        messages: text ? [...s.messages, { role: 'assistant', content: text }] : s.messages,
        streamingText: null,
        sending: false,
        turnId: null,
      }))
    })
    window.inlineStudio.events.onClaudeError((e) => {
      if (e.turnId !== get().turnId) return
      set({ error: e.error, streamingText: null, sending: false, turnId: null })
    })
  },

  send: async (prompt) => {
    const text = prompt.trim()
    if (!text || get().sending) return
    const messages: ClaudeMessage[] = [...get().messages, { role: 'user', content: text }]
    const turnId = crypto.randomUUID()
    set({ messages, streamingText: '', sending: true, turnId, error: null })
    try {
      const context = await buildContext(
        get().attachments.map((a) => ({ kind: a.kind, ids: a.ids, x: a.x, y: a.y })),
      )
      const res = await window.inlineStudio.claude.send({
        turnId,
        model: get().model,
        messages,
        context,
      })
      if (!res.ok) set({ error: res.error, sending: false, streamingText: null, turnId: null })
    } catch (e) {
      set({ error: ipcErrorMessage(e), sending: false, streamingText: null, turnId: null })
    }
  },

  cancel: () => {
    void window.inlineStudio.claude.cancel()
  },

  applyProposal: async (id) => {
    const proposal = get().proposals.find((p) => p.id === id)
    if (!proposal || get().applyingId) return
    set({
      applyingId: id,
      applyProgress: { done: 0, total: proposal.actions.length, label: null },
      error: null,
    })
    try {
      await applyClaudeActions(proposal.actions, (done, total, label) =>
        set({ applyProgress: { done, total, label } }),
      )
      set((s) => ({
        proposals: s.proposals.filter((p) => p.id !== id),
        applyingId: null,
        applyProgress: null,
      }))
    } catch (e) {
      set({ error: ipcErrorMessage(e), applyingId: null, applyProgress: null })
    }
  },

  dismissProposal: (id) => set((s) => ({ proposals: s.proposals.filter((p) => p.id !== id) })),

  attachSelection: () => {
    const ids = useUiStore.getState().canvasSelection
    if (ids.length === 0) return
    const { items } = useMoodboardStore.getState()
    const { frameName, assetName } = nameMaps()
    const byId = new Map(items.map((i) => [i.id, i]))
    const names = ids.map((id) => {
      const it = byId.get(id)
      return it ? itemDisplayName(it, frameName, assetName) : id
    })
    const label =
      names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2}`
    set((s) => ({
      attachments: [...s.attachments, { id: crypto.randomUUID(), kind: 'items', ids, label }],
    }))
  },

  attachSpot: () => {
    const c = useUiStore.getState().canvasCenter
    const x = Math.round(c.x)
    const y = Math.round(c.y)
    set((s) => ({
      attachments: [
        ...s.attachments,
        { id: crypto.randomUUID(), kind: 'spot', x, y, label: `Spot (${x}, ${y})` },
      ],
    }))
  },

  removeAttachment: (id) => set((s) => ({ attachments: s.attachments.filter((a) => a.id !== id) })),

  clearChat: () =>
    set({ messages: [], streamingText: null, proposals: [], attachments: [], error: null }),
}))
