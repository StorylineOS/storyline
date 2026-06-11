/** Workspace-level UI state: which top-level mode/tab is active. */
import { create } from 'zustand'

export type WorkspaceMode = 'edit' | 'moodboard' | 'generate'

interface UiState {
  mode: WorkspaceMode
  setMode: (mode: WorkspaceMode) => void
}

export const useUiStore = create<UiState>((set) => ({
  mode: 'edit',
  setMode: (mode) => set({ mode }),
}))
