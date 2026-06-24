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
  onAddDirector,
  onAddTrim,
}: {
  onAddFrame: () => void
  onAddLayer: () => void
  onAddPreview: () => void
  onAddText: () => void
  onAddDirector: () => void
  onAddTrim: () => void
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
      <ToolButton label="Add Video Director" onClick={onAddDirector}>
        <ClapperboardIcon />
      </ToolButton>
      <ToolButton label="Add Edit Video/Audio" onClick={onAddTrim}>
        <ScissorsIcon />
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

function ClapperboardIcon(): React.JSX.Element {
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
      {/* Hinged clapper bar with diagonal slashes */}
      <path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z" />
      <path d="m6.2 5.3 3.1 3.9" />
      <path d="m12.4 3.4 3.1 4" />
      {/* Slate body with two lines */}
      <path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M8 15.5h8" />
      <path d="M8 18.5h6" />
    </svg>
  )
}

function ScissorsIcon(): React.JSX.Element {
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
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12" />
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
