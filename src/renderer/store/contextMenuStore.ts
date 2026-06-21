/**
 * A tiny global right-click menu. A surface calls `open(event, items)` from its
 * `onContextMenu`; the single <ContextMenu/> mounted in the Workspace renders it.
 */
import { create } from 'zustand'

export interface ContextMenuItem {
  label: string
  onClick: () => void
  danger?: boolean
}

interface ContextMenuState {
  menu: { x: number; y: number; items: ContextMenuItem[] } | null
  open: (e: React.MouseEvent, items: ContextMenuItem[]) => void
  close: () => void
}

export const useContextMenuStore = create<ContextMenuState>((set) => ({
  menu: null,
  open: (e, items) => {
    if (items.length === 0) return
    e.preventDefault()
    e.stopPropagation()
    set({ menu: { x: e.clientX, y: e.clientY, items } })
  },
  close: () => set({ menu: null }),
}))
