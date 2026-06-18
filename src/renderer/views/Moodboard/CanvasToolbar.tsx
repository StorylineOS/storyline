import { useState } from 'react'

/**
 * Floating bottom-left action button. Click the accent + to expand node-creation
 * actions (Frame, Layer, Preview, Text); the + rotates into a close (×) while open.
 * It sits inside the canvas area, so it tracks the Assets panel as it opens/resizes.
 * Each action adds a node at the current canvas center and collapses the menu.
 */
export function CanvasToolbar({
  onAddFrame,
  onAddLayer,
  onAddPreview,
  onAddText,
}: {
  onAddFrame: () => void
  onAddLayer: () => void
  onAddPreview: () => void
  onAddText: () => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)

  const run = (fn: () => void) => (): void => {
    fn()
    setOpen(false)
  }

  return (
    <div className="absolute bottom-4 left-4 z-10 flex flex-col items-start gap-2">
      {open && (
        <>
          <SubAction label="Add frame" onClick={run(onAddFrame)}>
            <FrameIcon />
          </SubAction>
          <SubAction label="Add layer" onClick={run(onAddLayer)}>
            <LayerIcon />
          </SubAction>
          <SubAction label="Add preview" onClick={run(onAddPreview)}>
            <ImageIcon />
          </SubAction>
          <SubAction label="Add text" onClick={run(onAddText)}>
            <span className="text-base font-bold leading-none">T</span>
          </SubAction>
        </>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        title={open ? 'Close' : 'Add to canvas'}
        aria-label={open ? 'Close' : 'Add to canvas'}
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-panel shadow-lg hover:brightness-110"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          className={`h-5 w-5 transition-transform duration-200 ${open ? 'rotate-45' : ''}`}
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  )
}

function SubAction({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onClick}
        title={label}
        aria-label={label}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-panel text-zinc-200 shadow-md hover:border-accent hover:bg-surface hover:text-white"
      >
        {children}
      </button>
      <span className="rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-zinc-100 shadow">
        {label}
      </span>
    </div>
  )
}

function FrameIcon(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M3 15h18M9 4v16" />
    </svg>
  )
}

function LayerIcon(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
    >
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
}

function ImageIcon(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  )
}
