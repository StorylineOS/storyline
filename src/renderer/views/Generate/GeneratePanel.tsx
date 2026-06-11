import { useEffect, useState } from 'react'
import type { ComfyStatus, ProjectMediaDirs } from '@shared/types'
import { useSettingsStore } from '../../store/settingsStore'
import { useUiStore } from '../../store/uiStore'

/**
 * The Generate tab embeds ComfyUI in an iframe. It polls the backend; when it's not
 * reachable it shows guidance instead. The URL is editable (persisted to settings).
 * Per-shot "Send to ComfyUI" / "Pull result" actions live on the shot timeline.
 */
export function GeneratePanel(): React.JSX.Element {
  const { comfyUrl, load, setComfyUrl } = useSettingsStore()
  const linkedWorkflow = useUiStore((s) => s.linkedWorkflow)
  const setLinkedWorkflow = useUiStore((s) => s.setLinkedWorkflow)
  const [status, setStatus] = useState<ComfyStatus | null>(null)
  const [draftUrl, setDraftUrl] = useState('')
  const [dirs, setDirs] = useState<ProjectMediaDirs | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [showPaths, setShowPaths] = useState(false)

  const copy = (key: string, text: string): void => {
    void window.storyline.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied((current) => (current === key ? null : current)), 1500)
  }

  const check = async (): Promise<void> => {
    try {
      const res = await window.storyline.comfy.status()
      if (res.ok) setStatus(res.value)
    } catch {
      setStatus({ running: false, url: comfyUrl })
    }
  }

  useEffect(() => {
    void load()
    void (async () => {
      const res = await window.storyline.project.mediaDirs()
      if (res.ok) setDirs(res.value)
    })()
  }, [load])

  useEffect(() => {
    setDraftUrl(comfyUrl)
  }, [comfyUrl])

  useEffect(() => {
    void check()
    const timer = setInterval(() => void check(), 4000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comfyUrl])

  const running = status?.running ?? false
  const url = status?.url ?? comfyUrl
  const comfyArgs = dirs
    ? `--input-directory "${dirs.inputDir}" --output-directory "${dirs.outputDir}"`
    : ''

  return (
    <div className="flex h-full flex-col bg-panel">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span
          className={`h-2 w-2 rounded-full ${running ? 'bg-green-500' : 'bg-zinc-600'}`}
          title={running ? 'ComfyUI is running' : 'ComfyUI is not reachable'}
        />
        <span className="text-xs uppercase tracking-wide text-zinc-400">ComfyUI</span>
        <input
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void setComfyUrl(draftUrl)
          }}
          spellCheck={false}
          className="ml-2 w-72 rounded border border-border bg-surface px-2 py-1 text-xs text-zinc-200 outline-none focus:border-accent"
        />
        <button
          onClick={() => void setComfyUrl(draftUrl)}
          className="rounded border border-border px-2 py-1 text-xs text-zinc-300 hover:bg-surface"
        >
          Save
        </button>
        <button
          onClick={() => void check()}
          className="rounded border border-border px-2 py-1 text-xs text-zinc-300 hover:bg-surface"
        >
          Retry
        </button>
      </div>

      {dirs && (
        <div className="border-b border-border px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-zinc-400">
              Share these folders with ComfyUI — launch it with these arguments.
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                onClick={() => setShowPaths((v) => !v)}
                className="rounded border border-border px-2 py-1 text-[11px] text-zinc-300 hover:bg-surface"
              >
                {showPaths ? 'Hide Paths' : 'View Paths'}
              </button>
              <button
                onClick={() => copy('args', comfyArgs)}
                className="rounded border border-border px-2 py-1 text-[11px] text-zinc-300 hover:bg-surface"
              >
                {copied === 'args' ? 'Copied' : 'Copy arguments'}
              </button>
            </div>
          </div>
          {showPaths && (
            <div className="mt-1.5">
              <DirRow
                label="Input"
                path={dirs.inputDir}
                copied={copied === 'input'}
                onCopy={() => copy('input', dirs.inputDir)}
              />
              <DirRow
                label="Output"
                path={dirs.outputDir}
                copied={copied === 'output'}
                onCopy={() => copy('output', dirs.outputDir)}
              />
            </div>
          )}
        </div>
      )}

      {linkedWorkflow && (
        <div className="flex items-center justify-between gap-2 border-b border-accent/40 bg-accent/10 px-3 py-2">
          <span className="text-[11px] text-zinc-200">
            Open <span className="font-mono text-zinc-100">{linkedWorkflow}</span> from ComfyUI's{' '}
            <span className="text-zinc-100">Workflows</span> sidebar to edit this shot, then Save.
          </span>
          <button
            onClick={() => setLinkedWorkflow(null)}
            className="shrink-0 rounded border border-border px-2 py-1 text-[11px] text-zinc-300 hover:bg-surface"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="relative flex-1">
        {running ? (
          <iframe title="ComfyUI" src={url} className="h-full w-full border-0 bg-white" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm text-zinc-300">ComfyUI is not running</p>
            <p className="max-w-md text-xs text-zinc-500">
              Start ComfyUI and make sure it's reachable at{' '}
              <span className="text-zinc-300">{url}</span>. Update the URL above if it runs
              elsewhere, then press Retry.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function DirRow({
  label,
  path,
  copied,
  onCopy,
}: {
  label: string
  path: string
  copied: boolean
  onCopy: () => void
}): React.JSX.Element {
  return (
    <div className="mt-1 flex items-center gap-2">
      <span className="w-12 shrink-0 text-[10px] uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <code
        title={path}
        className="flex-1 truncate rounded bg-surface px-2 py-1 font-mono text-[11px] text-zinc-300"
      >
        {path}
      </code>
      <button
        onClick={onCopy}
        className="shrink-0 rounded border border-border px-2 py-1 text-[11px] text-zinc-300 hover:bg-surface"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
