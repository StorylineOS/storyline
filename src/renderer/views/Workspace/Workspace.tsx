import { useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import type { Project } from '@shared/types'
import { Logo } from '../../components/Logo'
import { useProjectStore } from '../../store/projectStore'
import { useAssetStore } from '../../store/assetStore'
import { useMoodboardStore } from '../../store/moodboardStore'
import { useShotStore } from '../../store/shotStore'
import { LibraryPanel } from '../Library/LibraryPanel'
import { PreviewPanel } from '../Preview/PreviewPanel'
import { TimelinePanel } from '../Timeline/TimelinePanel'
import { MoodboardPanel } from '../Moodboard/MoodboardPanel'

type Mode = 'edit' | 'moodboard'

/** The main editing shell (iMovie-style): assets left, preview right, timeline bottom. */
export function Workspace({ project }: { project: Project }): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('edit')
  const closeProject = useProjectStore((s) => s.closeProject)
  const resetAssets = useAssetStore((s) => s.reset)
  const resetBoard = useMoodboardStore((s) => s.reset)
  const resetShots = useShotStore((s) => s.reset)

  const onClose = (): void => {
    resetAssets()
    resetBoard()
    resetShots()
    closeProject()
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-3">
        <div className="flex items-center gap-2.5">
          <Logo size={26} />
          <span className="text-sm font-semibold text-white">Storyline</span>
          <span className="text-zinc-600">/</span>
          <span className="text-sm text-zinc-300">{project.name}</span>
        </div>

        <ModeToggle mode={mode} onChange={setMode} />

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-zinc-300 hover:bg-panel"
          >
            Close
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1">
        {mode === 'moodboard' ? (
          <MoodboardPanel />
        ) : (
          <PanelGroup direction="vertical" autoSaveId="storyline:workspace:v">
            <Panel defaultSize={62} minSize={30}>
              <PanelGroup direction="horizontal" autoSaveId="storyline:workspace:h">
                <Panel defaultSize={30} minSize={18} maxSize={50}>
                  <LibraryPanel />
                </Panel>
                <ResizeHandle orientation="vertical" />
                <Panel defaultSize={70} minSize={30}>
                  <PreviewPanel />
                </Panel>
              </PanelGroup>
            </Panel>
            <ResizeHandle orientation="horizontal" />
            <Panel defaultSize={38} minSize={15}>
              <TimelinePanel />
            </Panel>
          </PanelGroup>
        )}
      </main>
    </div>
  )
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode
  onChange: (m: Mode) => void
}): React.JSX.Element {
  const labels: Record<Mode, string> = { edit: 'Create', moodboard: 'Moodboard' }
  return (
    <div className="flex rounded-md border border-border bg-panel p-0.5 text-xs">
      {(['edit', 'moodboard'] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`rounded px-3 py-1 ${
            mode === m ? 'bg-accent text-white' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {labels[m]}
        </button>
      ))}
    </div>
  )
}

/** A divider that shows a subtle handle and highlights on drag. */
function ResizeHandle({
  orientation,
}: {
  orientation: 'horizontal' | 'vertical'
}): React.JSX.Element {
  const base = orientation === 'vertical' ? 'w-1.5 cursor-col-resize' : 'h-1.5 cursor-row-resize'
  return (
    <PanelResizeHandle
      className={`${base} bg-border transition-colors data-[resize-handle-state=drag]:bg-accent data-[resize-handle-state=hover]:bg-zinc-600`}
    />
  )
}
