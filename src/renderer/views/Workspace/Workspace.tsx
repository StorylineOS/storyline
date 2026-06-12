import type { Project } from '@shared/types'
import { Logo } from '../../components/Logo'
import { useProjectStore } from '../../store/projectStore'
import { useAssetStore } from '../../store/assetStore'
import { useMoodboardStore } from '../../store/moodboardStore'
import { useShotStore } from '../../store/shotStore'
import { useUiStore, type WorkspaceMode } from '../../store/uiStore'
import { MoodboardPanel } from '../Moodboard/MoodboardPanel'
import { GeneratePanel } from '../Generate/GeneratePanel'

/** The main shell: a node canvas ("Storyline") plus the embedded ComfyUI Generate tab. */
export function Workspace({ project }: { project: Project }): React.JSX.Element {
  const mode = useUiStore((s) => s.mode)
  const setMode = useUiStore((s) => s.setMode)
  const closeProject = useProjectStore((s) => s.closeProject)
  const resetAssets = useAssetStore((s) => s.reset)
  const resetBoard = useMoodboardStore((s) => s.reset)
  const resetShots = useShotStore((s) => s.reset)

  const onClose = (): void => {
    setMode('moodboard')
    resetAssets()
    resetBoard()
    resetShots()
    closeProject()
  }

  return (
    <div className="flex h-full flex-col">
      <header className="relative flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-3">
        <div className="flex items-center gap-2.5">
          <Logo size={26} />
          <span className="text-sm font-semibold text-white">Storyline</span>
          <span className="text-zinc-600">/</span>
          <span className="text-sm text-zinc-300">{project.name}</span>
        </div>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <ModeToggle mode={mode} onChange={setMode} />
        </div>

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
        {/* Generate stays mounted (just hidden) so ComfyUI doesn't reload and
            restore its previous tab each time — which raced our 'open workflow'
            and selected the wrong shot. */}
        <div className={mode === 'generate' ? 'h-full' : 'hidden'}>
          <GeneratePanel />
        </div>

        <div className={mode === 'moodboard' ? 'h-full' : 'hidden'}>
          <MoodboardPanel />
        </div>
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
