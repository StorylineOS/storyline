/** Workspace-level UI state: which top-level mode/tab is active. */
import { create } from 'zustand'

export type WorkspaceMode = 'edit' | 'moodboard' | 'generate'

interface UiState {
  mode: WorkspaceMode
  /** Name of the most recently linked ComfyUI workflow, for the Generate banner. */
  linkedWorkflow: string | null
  setMode: (mode: WorkspaceMode) => void
  setLinkedWorkflow: (name: string | null) => void
}

export const useUiStore = create<UiState>((set) => ({
  mode: 'edit',
  linkedWorkflow: null,
  setMode: (mode) => set({ mode }),
  setLinkedWorkflow: (linkedWorkflow) => set({ linkedWorkflow }),
}))
