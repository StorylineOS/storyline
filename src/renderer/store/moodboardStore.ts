/**
 * Moodboard state: the board's items + connectors. The canvas (React Flow) owns
 * transient drag positions; this store is the persisted source of truth and is
 * updated on discrete events (drag stop, resize end, text edit), each persisted
 * to main via window.storyline.moodboard.
 */
import { create } from 'zustand'
import type { MoodboardItem, MoodboardConnector } from '@shared/types'
import type { MoodboardItemPatch } from '@shared/ipc'
import { ipcErrorMessage } from '../lib/ipcError'
import { useShotStore } from './shotStore'

interface MoodboardState {
  items: MoodboardItem[]
  connectors: MoodboardConnector[]
  loading: boolean
  error: string | null

  load: () => Promise<void>
  addAssetAt: (assetId: string, x: number, y: number) => Promise<void>
  addTextAt: (x: number, y: number) => Promise<void>
  addShotFromAsset: (assetId: string, x: number, y: number) => Promise<void>
  addShotItem: (shotId: string, x: number, y: number) => Promise<void>
  addPreview: (x: number, y: number) => Promise<void>
  addLayer: (x: number, y: number) => Promise<void>
  /** Place an existing asset on the board, parented to a layer when given. */
  addShotFromAssetInLayer: (
    assetId: string,
    x: number,
    y: number,
    parentId: string | null,
  ) => Promise<void>
  importAndPlace: (x: number, y: number) => Promise<MoodboardItem[]>
  updateItem: (id: string, patch: MoodboardItemPatch) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  connect: (
    fromItemId: string,
    toItemId: string,
    sourceHandle?: string | null,
    targetHandle?: string | null,
  ) => Promise<void>
  disconnect: (connectorId: string) => Promise<void>
  reset: () => void
}

function applyPatch(item: MoodboardItem, patch: MoodboardItemPatch): MoodboardItem {
  return {
    ...item,
    x: patch.x ?? item.x,
    y: patch.y ?? item.y,
    width: patch.width ?? item.width,
    height: patch.height ?? item.height,
    rotation: patch.rotation ?? item.rotation,
    zIndex: patch.zIndex ?? item.zIndex,
    data: patch.data ?? item.data,
    // parentId can be set to null (detach), so distinguish "absent" from "null".
    parentId: patch.parentId !== undefined ? patch.parentId : item.parentId,
  }
}

export const useMoodboardStore = create<MoodboardState>((set) => ({
  items: [],
  connectors: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const res = await window.storyline.moodboard.list()
      if (!res.ok) return set({ loading: false, error: res.error })
      set({ items: res.value.items, connectors: res.value.connectors, loading: false })
    } catch (e) {
      set({ loading: false, error: ipcErrorMessage(e) })
    }
  },

  addAssetAt: async (assetId, x, y) => {
    try {
      const res = await window.storyline.moodboard.addAsset(assetId, x, y)
      if (!res.ok) return set({ error: res.error })
      set((s) => ({ items: [...s.items, res.value] }))
    } catch (e) {
      set({ error: ipcErrorMessage(e) })
    }
  },

  addTextAt: async (x, y) => {
    try {
      const res = await window.storyline.moodboard.addText(x, y)
      if (!res.ok) return set({ error: res.error })
      set((s) => ({ items: [...s.items, res.value] }))
    } catch (e) {
      set({ error: ipcErrorMessage(e) })
    }
  },

  addShotFromAsset: async (assetId, x, y) => {
    try {
      const res = await window.storyline.moodboard.addShotFromAsset(assetId, x, y)
      if (!res.ok) return set({ error: res.error })
      set((s) => ({ items: [...s.items, res.value] }))
    } catch (e) {
      set({ error: ipcErrorMessage(e) })
    }
  },

  addShotItem: async (shotId, x, y) => {
    try {
      const res = await window.storyline.moodboard.addShotItem(shotId, x, y)
      if (!res.ok) return set({ error: res.error })
      set((s) => ({ items: [...s.items, res.value] }))
    } catch (e) {
      set({ error: ipcErrorMessage(e) })
    }
  },

  addPreview: async (x, y) => {
    try {
      const res = await window.storyline.moodboard.addPreview(x, y)
      if (!res.ok) return set({ error: res.error })
      set((s) => ({ items: [...s.items, res.value] }))
    } catch (e) {
      set({ error: ipcErrorMessage(e) })
    }
  },

  addLayer: async (x, y) => {
    try {
      const res = await window.storyline.moodboard.addLayer(x, y)
      if (!res.ok) return set({ error: res.error })
      set((s) => ({ items: [...s.items, res.value] }))
    } catch (e) {
      set({ error: ipcErrorMessage(e) })
    }
  },

  addShotFromAssetInLayer: async (assetId, x, y, parentId) => {
    try {
      const res = await window.storyline.moodboard.addShotFromAsset(assetId, x, y)
      if (!res.ok) return set({ error: res.error })
      let item = res.value
      if (parentId) {
        const patched = await window.storyline.moodboard.updateItem(item.id, { parentId })
        if (patched.ok) item = patched.value
      }
      set((s) => ({ items: [...s.items, item] }))
      // The shot + its input row were created in main; refresh the shot store so
      // the new ShotNode shows its name, input asset, and (future) takes.
      await useShotStore.getState().load()
    } catch (e) {
      set({ error: ipcErrorMessage(e) })
    }
  },

  connect: async (fromItemId, toItemId, sourceHandle = null, targetHandle = null) => {
    try {
      const res = await window.storyline.moodboard.createConnector(
        fromItemId,
        toItemId,
        sourceHandle,
        targetHandle,
      )
      if (!res.ok) return set({ error: res.error })
      set((s) => ({ connectors: [...s.connectors, res.value] }))
    } catch (e) {
      set({ error: ipcErrorMessage(e) })
    }
  },

  disconnect: async (connectorId) => {
    try {
      const res = await window.storyline.moodboard.deleteConnector(connectorId)
      if (!res.ok) return set({ error: res.error })
      set((s) => ({ connectors: s.connectors.filter((c) => c.id !== connectorId) }))
    } catch (e) {
      set({ error: ipcErrorMessage(e) })
    }
  },

  importAndPlace: async (x, y) => {
    try {
      const res = await window.storyline.moodboard.importAndPlace(x, y)
      if (!res.ok) {
        set({ error: res.error })
        return []
      }
      set((s) => ({ items: [...s.items, ...res.value] }))
      return res.value
    } catch (e) {
      set({ error: ipcErrorMessage(e) })
      return []
    }
  },

  updateItem: async (id, patch) => {
    // Optimistic: keep the canvas snappy, then persist.
    set((s) => ({ items: s.items.map((it) => (it.id === id ? applyPatch(it, patch) : it)) }))
    try {
      const res = await window.storyline.moodboard.updateItem(id, patch)
      if (!res.ok) set({ error: res.error })
    } catch (e) {
      set({ error: ipcErrorMessage(e) })
    }
  },

  deleteItem: async (id) => {
    try {
      const res = await window.storyline.moodboard.deleteItem(id)
      if (!res.ok) return set({ error: res.error })
      set((s) => ({
        items: s.items.filter((it) => it.id !== id),
        connectors: s.connectors.filter((c) => c.fromItemId !== id && c.toItemId !== id),
      }))
    } catch (e) {
      set({ error: ipcErrorMessage(e) })
    }
  },

  reset: () => set({ items: [], connectors: [], error: null }),
}))
