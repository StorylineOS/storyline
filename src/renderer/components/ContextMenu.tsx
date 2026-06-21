import { useEffect } from 'react'
import { useContextMenuStore } from '../store/contextMenuStore'

/**
 * Single floating right-click menu, mounted once near the app root. Reads the open
 * menu from the context-menu store; a full-screen backdrop dismisses on click,
 * right-click, or Escape. Position is clamped to stay on screen.
 */
export function ContextMenu(): React.JSX.Element | null {
  const menu = useContextMenuStore((s) => s.menu)
  const close = useContextMenuStore((s) => s.close)

  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menu, close])

  if (!menu) return null

  const width = 180
  const x = Math.min(menu.x, window.innerWidth - width - 8)
  const y = Math.min(menu.y, window.innerHeight - menu.items.length * 32 - 8)

  return (
    <>
      <div
        className="fixed inset-0 z-[200]"
        onClick={close}
        onContextMenu={(e) => {
          e.preventDefault()
          close()
        }}
      />
      <div
        className="fixed z-[201] overflow-hidden rounded-md border border-border bg-panel py-1 text-xs shadow-xl"
        style={{ left: x, top: y, minWidth: width }}
      >
        {menu.items.map((item, i) => (
          <button
            key={i}
            onClick={() => {
              close()
              item.onClick()
            }}
            className={`block w-full px-3 py-1.5 text-left hover:bg-surface ${
              item.danger ? 'text-red-400' : 'text-zinc-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  )
}
