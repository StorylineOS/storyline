/**
 * Shot timeline state: the ordered shots of the open project. Generation/takes
 * arrive in Slice B; Slice A covers import, rename, reorder, delete, select.
 */
import { create } from 'zustand'
import type { Shot, Take } from '@shared/types'
import { ipcErrorMessage } from '../lib/ipcError'

interface ShotState {
  shots: Shot[]
  /** Hero (Output) take per shot id, for rendering the Output row. */
  outputs: Record<string, Take>
  selectedId: string | null
  loading: boolean
  /** Shot id currently mid-action (send/pull), for in-card spinners. */
  busyId: string | null
  error: string | null
  /** Transient status message (e.g. export summary). */
  notice: string | null

  load: () => Promise<void>
  importAsShots: () => Promise<void>
  addFromAsset: (assetId: string) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  reorder: (orderedIds: string[]) => Promise<void>
  remove: (id: string) => Promise<void>
  linkShot: (id: string) => Promise<Shot | null>
  pullResult: (id: string) => Promise<void>
  exportShots: () => Promise<void>
  select: (id: string | null) => void
  reset: () => void
}

function indexTakes(takes: Take[]): Record<string, Take> {
  const map: Record<string, Take> = {}
  for (const take of takes) map[take.shotId] = take
  return map
}

export const useShotStore = create<ShotState>((set) => ({
  shots: [],
  outputs: {},
  selectedId: null,
  loading: false,
  busyId: null,
  error: null,
  notice: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const [shotsRes, takesRes] = await Promise.all([
        window.storyline.shots.list(),
        window.storyline.shots.heroTakes(),
      ])
      if (!shotsRes.ok) return set({ loading: false, error: shotsRes.error })
      if (!takesRes.ok) return set({ loading: false, error: takesRes.error })
      set({ shots: shotsRes.value, outputs: indexTakes(takesRes.value), loading: false })
    } catch (e) {
      set({ loading: false, error: ipcErrorMessage(e) })
    }
  },

  linkShot: async (id) => {
    set({ busyId: id, error: null })
    try {
      const res = await window.storyline.comfy.linkShot(id)
      if (!res.ok) {
        set({ error: res.error, busyId: null })
        return null
      }
      const shot = res.value
      set((s) => ({
        shots: s.shots.map((sh) => (sh.id === id ? shot : sh)),
        busyId: null,
      }))
      return shot
    } catch (e) {
      set({ error: ipcErrorMessage(e), busyId: null })
      return null
    }
  },

  pullResult: async (id) => {
    set({ busyId: id, error: null })
    try {
      const res = await window.storyline.comfy.pullLatest(id)
      if (!res.ok) return set({ error: res.error, busyId: null })
      const take = res.value
      set((s) => ({
        outputs: { ...s.outputs, [id]: take },
        shots: s.shots.map((sh) => (sh.id === id ? { ...sh, heroTakeId: take.id } : sh)),
        busyId: null,
      }))
    } catch (e) {
      set({ error: ipcErrorMessage(e), busyId: null })
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

  exportShots: async () => {
    set({ error: null, notice: null })
    try {
      const res = await window.storyline.export.exportShots()
      if (!res.ok) return set({ error: res.error })
      if (res.value === null) return // cancelled
      const { exported, skipped, dir } = res.value
      const skip = skipped.length > 0 ? `, ${skipped.length} skipped (no output)` : ''
      set({ notice: `Exported ${exported} shot${exported === 1 ? '' : 's'}${skip} → ${dir}` })
    } catch (e) {
      set({ error: ipcErrorMessage(e) })
    }
  },

  select: (id) => set({ selectedId: id }),
  reset: () =>
    set({ shots: [], outputs: {}, selectedId: null, busyId: null, error: null, notice: null }),
}))
