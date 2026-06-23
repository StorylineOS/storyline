import { useState } from 'react'
import { Logo } from '../../components/Logo'
import { useProjectStore } from '../../store/projectStore'

export function ProjectLauncher(): React.JSX.Element {
  const {
    recents,
    loading,
    error,
    notice,
    exportingPath,
    createProject,
    openFromDialog,
    openByPath,
    exportProject,
  } = useProjectStore()
  const [name, setName] = useState('')

  const canCreate = name.trim().length > 0 && !loading
  const exporting = exportingPath !== null

  return (
    <div className="relative flex h-full items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <header className="mb-10 text-center">
          <div className="flex items-center justify-center gap-3">
            <Logo size={44} />
            <h1 className="text-4xl font-semibold tracking-tight text-white">Inline Studio</h1>
          </div>
          <p className="mt-3 text-sm text-zinc-400">
            An experimentation layer for visual artists. Build, iterate, and share generative
            pipelines on your own ComfyUI.
          </p>
        </header>

        <section className="mb-6 rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-medium text-zinc-300">New project</h2>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canCreate) void createProject(name.trim())
              }}
              placeholder="Untitled film"
              className="flex-1 rounded-lg border border-border bg-panel px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-accent"
            />
            <button
              disabled={!canCreate}
              onClick={() => void createProject(name.trim())}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-panel disabled:opacity-40"
            >
              Create
            </button>
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-zinc-400">
            <button
              onClick={() => void openFromDialog()}
              disabled={loading}
              className="underline-offset-2 hover:text-zinc-200 hover:underline"
            >
              …or open an existing project
            </button>
          </div>
        </section>

        {error && (
          <p className="mb-4 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        {notice && (
          <p className="mb-4 rounded-lg border border-green-900 bg-green-950/30 px-3 py-2 text-sm text-green-300">
            {notice}
          </p>
        )}

        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-medium text-zinc-300">Recent</h2>
          {recents.length === 0 ? (
            <p className="text-sm text-zinc-500">No recent projects yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recents.map((r) => (
                <li key={r.path} className="flex items-center gap-2 py-1">
                  <button
                    onClick={() => void openByPath(r.path)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 py-1 text-left hover:opacity-80"
                  >
                    <span className="shrink-0 text-sm text-zinc-200">{r.name}</span>
                    <span className="min-w-0 truncate text-xs text-zinc-500">{r.path}</span>
                  </button>
                  <button
                    onClick={() => void exportProject(r.path)}
                    disabled={exporting}
                    title="Export this project as a portable .zip"
                    className="shrink-0 rounded border border-border px-2 py-1 text-[11px] text-zinc-300 hover:bg-panel disabled:opacity-40"
                  >
                    {exportingPath === r.path ? 'Exporting…' : 'Export'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="absolute bottom-6 left-0 right-0 text-center text-xs text-zinc-500">
        Have a question?{' '}
        <button
          onClick={() =>
            void window.inlineStudio.shell.openExternal('https://discord.gg/cSUS88VdY9')
          }
          className="text-accent underline-offset-2 hover:underline"
        >
          Connect the team on Discord
        </button>
      </p>
    </div>
  )
}
