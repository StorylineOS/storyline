/** Workspace-level UI state: which top-level mode/tab is active. */
import { create } from 'zustand'

export type WorkspaceMode = 'moodboard' | 'generate'

interface UiState {
  mode: WorkspaceMode
  /** Name of the most recently linked ComfyUI workflow, for the Generate banner. */
  linkedWorkflow: string | null
  /** The frame whose workflow is open in Generate — capture targets this frame. */
  activeFrameId: string | null
  setMode: (mode: WorkspaceMode) => void
  setLinkedWorkflow: (name: string | null) => void
  setActiveFrame: (frameId: string | null) => void
}

export const useUiStore = create<UiState>((set) => ({
  mode: 'moodboard',
  linkedWorkflow: null,
  activeFrameId: null,
  setMode: (mode) => set({ mode }),
  setLinkedWorkflow: (linkedWorkflow) => set({ linkedWorkflow }),
  setActiveFrame: (activeFrameId) => set({ activeFrameId }),
}))
