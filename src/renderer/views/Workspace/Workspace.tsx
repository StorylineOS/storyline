import { useCallback, useRef, useState } from 'react'
import type { Project } from '@shared/types'
import { Logo } from '../../components/Logo'
import { ClaudeLogo } from '../../components/ClaudeLogo'
import { useProjectStore } from '../../store/projectStore'
import { useAssetStore } from '../../store/assetStore'
import { useMoodboardStore } from '../../store/moodboardStore'
import { useFrameStore } from '../../store/frameStore'
import { useUiStore, type WorkspaceMode } from '../../store/uiStore'
import { MoodboardPanel } from '../Moodboard/MoodboardPanel'
import { GeneratePanel } from '../Generate/GeneratePanel'
import { AssistantPanel } from '../Assistant/AssistantPanel'

/** The main shell: a node canvas ("Storyline") plus the embedded ComfyUI Generate tab. */
export function Workspace({ project }: { project: Project }): React.JSX.Element {
  const mode = useUiStore((s) => s.mode)
  const setMode = useUiStore((s) => s.setMode)
  const assistantOpen = useUiStore((s) => s.assistantOpen)
  const setAssistantOpen = useUiStore((s) => s.setAssistantOpen)
  const closeProject = useProjectStore((s) => s.closeProject)
  const resetAssets = useAssetStore((s) => s.reset)
  const resetBoard = useMoodboardStore((s) => s.reset)
  const resetFrames = useFrameStore((s) => s.reset)

  const onClose = (): void => {
    setMode('moodboard')
    resetAssets()
    resetBoard()
    resetFrames()
    closeProject()
  }

  // Resizable assistant sidebar.
  const [assistantWidth, setAssistantWidth] = useState(384)
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null)
  const onDragStart = useCallback(
    (e: React.MouseEvent): void => {
      dragState.current = { startX: e.clientX, startWidth: assistantWidth }
      const onMove = (ev: MouseEvent): void => {
        if (!dragState.current) return
        // Sidebar is on the right, so dragging left (negative dx) widens it.
        const next = dragState.current.startWidth - (ev.clientX - dragState.current.startX)
        setAssistantWidth(Math.min(720, Math.max(300, next)))
      }
      const onUp = (): void => {
        dragState.current = null
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [assistantWidth],
  )

  return (
    <div className="flex h-full flex-col">
      <header className="relative flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onClose}
            title="Back to your projects"
            className="-m-1 flex items-center gap-2.5 rounded p-1 transition-opacity hover:opacity-75"
          >
            <Logo size={26} />
            <span className="text-sm font-semibold text-white">Storyline</span>
          </button>
          <span className="text-zinc-600">/</span>
          <span className="text-sm text-zinc-300">{project.name}</span>
        </div>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <ModeToggle mode={mode} onChange={setMode} />
        </div>

        <div className="flex items-center">
          <button
            onClick={() => setAssistantOpen(!assistantOpen)}
            title={assistantOpen ? 'Hide Claude assistant' : 'Open Claude assistant'}
            className={`-m-1 p-1 transition-colors ${
              assistantOpen ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ClaudeLogo size={20} />
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1">
        <div className="relative min-h-0 flex-1">
          {/* Generate stays mounted (just hidden) so ComfyUI doesn't reload and
              restore its previous tab each time — which raced our 'open workflow'
              and selected the wrong frame. */}
          <div className={mode === 'generate' ? 'h-full' : 'hidden'}>
            <GeneratePanel />
          </div>

          <div className={mode === 'moodboard' ? 'h-full' : 'hidden'}>
            <MoodboardPanel />
          </div>
        </div>

        {assistantOpen && (
          <>
            <div
              onMouseDown={onDragStart}
              title="Drag to resize"
              className="w-1 shrink-0 cursor-col-resize bg-border hover:bg-accent"
            />
            <div className="min-h-0 shrink-0" style={{ width: assistantWidth }}>
              <AssistantPanel />
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: WorkspaceMode
  onChange: (m: WorkspaceMode) => void
}): React.JSX.Element {
  const labels: Record<WorkspaceMode, string> = {
    moodboard: 'Storyline',
    generate: 'Generate',
  }
  return (
    <div className="flex rounded-md border border-border bg-panel p-0.5 text-xs">
      {(['moodboard', 'generate'] as const).map((m) => (
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
