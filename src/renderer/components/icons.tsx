/**
 * Material Design icons as inline SVGs. We can't load the Material Symbols web
 * font (the renderer CSP only allows `'self'` for styles/scripts and no external
 * font-src), so these mirror the official 24×24 Material glyph paths and follow
 * the codebase's existing inline-SVG icon convention.
 *
 * Each icon takes a `className` (default sizes to 1em via `h-[1em] w-[1em]`) and
 * paints with `currentColor` so callers control colour/size through text utils.
 */

function Svg({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className ?? 'h-[1em] w-[1em]'}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

/** `image` — pictures / assets. */
export function ImageIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
    </Svg>
  )
}

/** `history` — timeline / past takes. */
export function HistoryIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
    </Svg>
  )
}

/** `account_tree` — a linked Comfy workflow. */
export function WorkflowIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <path d="M22 11V3h-7v3H9V3H2v8h7V8h2v10h4v3h7v-8h-7v3h-2V8h2v3z" />
    </Svg>
  )
}

/** `edit` — pencil. */
export function EditIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </Svg>
  )
}

/** `create_new_folder` — folder with a +. */
export function CreateNewFolderIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-1 8h-3v3h-2v-3h-3v-2h3V9h2v3h3v2z" />
    </Svg>
  )
}

/** `file_download` — arrow into a tray, used for import. */
export function DownloadIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
    </Svg>
  )
}

/** `add` — plus sign. */
export function PlusIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
    </Svg>
  )
}

/** `folder` — a standard directory. */
export function FolderIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
    </Svg>
  )
}
