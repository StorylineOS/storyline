/**
 * Shot timeline state: the ordered shots of the open project. Generation/takes
 * arrive in Slice B; Slice A covers import, rename, reorder, delete, select.
 */
import { create } from 'zustand'
import type { Shot } from '@shared/types'
import { ipcErrorMessage } from '../lib/ipcError'

interface ShotState {
  shots: Shot[]
  selectedId: string | null
  loading: boolean
  error: string | null

  load: () => Promise<void>
  importAsShots: () => Promise<void>
  addFromAsset: (assetId: string) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  reorder: (orderedIds: string[]) => Promise<void>
  remove: (id: string) => Promise<void>
  select: (id: string | null) => void
  reset: () => void
}

export const useShotStore = create<ShotState>((set) => ({
  shots: [],
  selectedId: null,
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const res = await window.storyline.shots.list()
      if (!res.ok) return set({ loading: false, error: res.error })
      set({ shots: res.value, loading: false })
    } catch (e) {
      set({ loading: false, error: ipcErrorMessage(e) })
    }
  },

  importAsShots: async () => {
    set({ loading: true, error: null })
    try {
      const res = await window.storyline.shots.importAsShots()
      if (!res.ok) return set({ loading: false, error: res.error })
      set((s) => ({ shots: [...s.shots, ...res.value], loading: false }))
    } catch (e) {
      set({ loading: false, error: ipcErrorMessage(e) })
    }
  },

  addFromAsset: async (assetId) => {
    try {
      const res = await window.storyline.shots.addFromAsset(assetId)
      if (!res.ok) return set({ error: res.error })
      set((s) => ({ shots: [...s.shots, res.value] }))
    } catch (e) {
      set({ error: ipcErrorMessage(e) })
    }
  },

  rename: async (id, name) => {
    set((s) => ({ shots: s.shots.map((sh) => (sh.id === id ? { ...sh, name } : sh)) }))
    try {
      const res = await window.storyline.shots.rename(id, name)
      if (!res.ok) set({ error: res.error })
    } catch (e) {
      set({ error: ipcErrorMessage(e) })
    }
  },

  reorder: async (orderedIds) => {
    // Optimistic reorder for a snappy drag.
    set((s) => {
      const byId = new Map(s.shots.map((sh) => [sh.id, sh]))
      const next = orderedIds
        .map((id, i) => {
          const sh = byId.get(id)
          return sh ? { ...sh, position: i } : null
        })
        .filter((x): x is Shot => x !== null)
      return { shots: next }
    })
    try {
      const res = await window.storyline.shots.reorder(orderedIds)
      if (!res.ok) set({ error: res.error })
    } catch (e) {
      set({ error: ipcErrorMessage(e) })
    }
  },

  remove: async (id) => {
    try {
      const res = await window.storyline.shots.delete(id)
      if (!res.ok) return set({ error: res.error })
      set((s) => ({
        shots: s.shots.filter((sh) => sh.id !== id),
        selectedId: s.selectedId === id ? null : s.selectedId,
      }))
    } catch (e) {
      set({ error: ipcErrorMessage(e) })
    }
  },

  select: (id) => set({ selectedId: id }),
  reset: () => set({ shots: [], selectedId: null, error: null }),
}))
