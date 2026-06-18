/**
 * Feature-scoped store for the currently open project + recents. Components
 * render from this; all real work happens in main via the IPC bridge.
 */
import { create } from 'zustand'
import type { Project, RecentProject } from '@shared/types'

interface ProjectState {
  current: Project | null
  recents: RecentProject[]
  loading: boolean
  error: string | null

  loadRecents: () => Promise<void>
  createProject: (name: string) => Promise<void>
  openFromDialog: () => Promise<void>
  openByPath: (path: string) => Promise<void>
  closeProject: () => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  current: null,
  recents: [],
  loading: false,
  error: null,

  loadRecents: async () => {
    const res = await window.inlineStudio.project.listRecent()
    if (res.ok) set({ recents: res.value })
  },

  createProject: async (name: string) => {
    set({ loading: true, error: null })
    const dir = await window.inlineStudio.dialog.pickDirectory()
    if (!dir.ok) return set({ loading: false, error: dir.error })
    if (dir.value === null) return set({ loading: false })

    const res = await window.inlineStudio.project.create({ name, parentDir: dir.value })
    if (!res.ok) return set({ loading: false, error: res.error })
    set({ current: res.value, loading: false })
    void get().loadRecents()
  },

  openFromDialog: async () => {
    set({ loading: true, error: null })
    const res = await window.inlineStudio.project.openDialog()
    if (!res.ok) return set({ loading: false, error: res.error })
    if (res.value === null) return set({ loading: false })
    set({ current: res.value, loading: false })
    void get().loadRecents()
  },

  openByPath: async (path: string) => {
    set({ loading: true, error: null })
    const res = await window.inlineStudio.project.open(path)
    if (!res.ok) return set({ loading: false, error: res.error })
    set({ current: res.value, loading: false })
    void get().loadRecents()
  },

  closeProject: () => set({ current: null, error: null }),
}))
