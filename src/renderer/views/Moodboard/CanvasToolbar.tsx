/**
 * Floating bottom-left widget bar: a vertical strip of node-creation buttons (Frame,
 * Layer, Preview, Text), always visible. Each adds a node at the current canvas center.
 * It sits inside the canvas area, so it tracks the Assets panel as it opens/resizes.
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
  return (
    <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1 rounded-lg border border-border bg-panel/95 p-1 shadow-lg backdrop-blur">
      <ToolButton label="Add frame" onClick={onAddFrame}>
        <FrameIcon />
      </ToolButton>
      <ToolButton label="Add layer" onClick={onAddLayer}>
        <LayerIcon />
      </ToolButton>
      <ToolButton label="Add preview" onClick={onAddPreview}>
        <ImageIcon />
      </ToolButton>
      <ToolButton label="Add text" onClick={onAddText}>
        <span className="text-base font-bold leading-none">T</span>
      </ToolButton>
    </div>
  )
}

function ToolButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="group relative flex h-9 w-9 items-center justify-center rounded-md text-accent hover:bg-surface hover:brightness-110"
    >
      {children}
      {/* Hover label, to the right since the bar hugs the left edge. */}
      <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded bg-black/80 px-1.5 py-0.5 text-[11px] text-zinc-100 opacity-0 shadow transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </button>
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
