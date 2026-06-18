import { useState } from 'react'
import { Logo } from '../../components/Logo'
import { useProjectStore } from '../../store/projectStore'

export function ProjectLauncher(): React.JSX.Element {
  const { recents, loading, error, createProject, openFromDialog, openByPath } = useProjectStore()
  const [name, setName] = useState('')

  const canCreate = name.trim().length > 0 && !loading

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <header className="mb-10 text-center">
          <div className="flex items-center justify-center gap-3">
            <Logo size={44} />
            <h1 className="text-4xl font-semibold tracking-tight text-white">Inline Studio</h1>
          </div>
          <p className="mt-3 text-sm text-zinc-400">
            A narrative-first desktop app for visual artists, powered by your own ComfyUI.
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
          <button
            onClick={() => void openFromDialog()}
            disabled={loading}
            className="mt-3 text-xs text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
          >
            …or open an existing project (.inlinestudio or legacy .storyline)
          </button>
        </section>

        {error && (
          <p className="mb-4 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-medium text-zinc-300">Recent</h2>
          {recents.length === 0 ? (
            <p className="text-sm text-zinc-500">No recent projects yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recents.map((r) => (
                <li key={r.path}>
                  <button
                    onClick={() => void openByPath(r.path)}
                    className="flex w-full items-center justify-between py-2 text-left hover:opacity-80"
                  >
                    <span className="text-sm text-zinc-200">{r.name}</span>
                    <span className="max-w-[55%] truncate text-xs text-zinc-500">{r.path}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
