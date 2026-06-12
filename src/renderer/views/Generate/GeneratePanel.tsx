import { useEffect, useRef, useState } from 'react'
import type { ComfyStatus, ComfyOutput, ComfyRun } from '@shared/types'
import { useSettingsStore } from '../../store/settingsStore'
import { useUiStore } from '../../store/uiStore'
import { useFrameStore } from '../../store/frameStore'
import type { ComfyWebview } from '../../types/webview'

/**
 * Code injected INTO the embedded ComfyUI page (via webview.executeJavaScript, which
 * bypasses cross-origin limits in Electron) to open a frame's saved workflow.
 *
 * Preferred: open the *saved* workflow file through ComfyUI's workflow store (exposed
 * on window.comfyAPI) so it becomes that named tab and Save overwrites the same file —
 * which keeps the frame↔workflow link intact. Falls back to loadGraphData (which opens
 * an Unsaved Workflow) only if the store isn't reachable. Resolves to a status string:
 * 'opened' (saved tab) | 'loaded' (unsaved fallback) | 'failed'.
 */
function openWorkflowScript(name: string): string {
  const n = JSON.stringify(name)
  return `(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const waitFor = async (fn) => {
      const start = Date.now();
      while (Date.now() - start < 8000) {
        try { if (fn()) return true; } catch (e) {}
        await sleep(200);
      }
      return false;
    };
    await waitFor(() => window.app && window.app.graph);
    const path = 'workflows/' + ${n} + '.json';

    // 1) Open the SAVED workflow via the workflow store (so Save targets the same file).
    try {
      const reg = window.comfyAPI || {};
      let useWorkflowStore = reg.workflowStore && reg.workflowStore.useWorkflowStore;
      if (!useWorkflowStore) {
        for (const k in reg) {
          if (reg[k] && reg[k].useWorkflowStore) { useWorkflowStore = reg[k].useWorkflowStore; break; }
        }
      }
      if (useWorkflowStore) {
        const store = useWorkflowStore();
        let wf = null;
        if (typeof store.getWorkflowByPath === 'function') wf = store.getWorkflowByPath(path);
        if (!wf && Array.isArray(store.workflows)) {
          wf = store.workflows.find((w) =>
            w && (w.path === path || w.key === path || (w.path && w.path.endsWith(${n} + '.json'))));
        }
        if (wf && typeof store.openWorkflow === 'function') { await store.openWorkflow(wf); return 'opened'; }
      }
    } catch (e) { console.error('[storyline] store open failed', e); }

    // 2) Fallback: load the graph (opens as an Unsaved Workflow).
    try {
      if (window.app && typeof window.app.loadGraphData === 'function') {
        const res = await fetch('/userdata/' + encodeURIComponent(path));
        if (res.ok) { window.app.loadGraphData(await res.json(), true, true, ${n}); return 'loaded'; }
      }
    } catch (e) { console.error('[storyline] loadGraphData failed', e); }
    return 'failed';
  })();`
}

/**
 * The Generate tab embeds ComfyUI in an iframe. It polls the backend; when it's not
 * reachable it shows guidance instead. The URL is editable (persisted to settings).
 * Per-frame "Send to ComfyUI" / "Pull result" actions live on the frame timeline.
 */
export function GeneratePanel(): React.JSX.Element {
  const { comfyUrl, load, setComfyUrl } = useSettingsStore()
  const linkedWorkflow = useUiStore((s) => s.linkedWorkflow)
  const setLinkedWorkflow = useUiStore((s) => s.setLinkedWorkflow)
  const activeFrameId = useUiStore((s) => s.activeFrameId)
  const activeFrame = useFrameStore((s) => s.frames.find((sh) => sh.id === activeFrameId))
  const captureOutput = useFrameStore((s) => s.captureOutput)
  const [status, setStatus] = useState<ComfyStatus | null>(null)
  const [draftUrl, setDraftUrl] = useState('')
  const webviewRef = useRef<ComfyWebview | null>(null)
  const [webviewReady, setWebviewReady] = useState(false)
  // Capture strip: the latest finished run + which of its outputs we've captured.
  const [run, setRun] = useState<ComfyRun | null>(null)
  const [captured, setCaptured] = useState<Set<string>>(new Set())
  const seenPromptId = useRef<string | null>(null)

  const running = status?.running ?? false
  const url = status?.url ?? comfyUrl

  const onCapture = (output: ComfyOutput): void => {
    if (!activeFrameId) return
    void captureOutput(activeFrameId, output)
    setCaptured((s) => new Set(s).add(output.url))
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

  // Poll /history while running; when a NEW run finishes, show its outputs to capture.
  useEffect(() => {
    if (!running) return
    let cancelled = false
    const poll = async (): Promise<void> => {
      try {
        const res = await window.storyline.comfy.latestRun()
        if (cancelled || !res.ok || !res.value) return
        const latest = res.value
        if (seenPromptId.current === null) {
          seenPromptId.current = latest.promptId // baseline: ignore pre-existing runs
        } else if (latest.promptId !== seenPromptId.current) {
          seenPromptId.current = latest.promptId
          if (latest.outputs.length > 0) {
            setRun(latest)
            setCaptured(new Set())
          }
        }
      } catch {
        // ignore transient errors
      }
    }
    void poll()
    const timer = setInterval(() => void poll(), 2000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [running])

  // Track when the embedded ComfyUI page has loaded enough to drive.
  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) {
      setWebviewReady(false)
      return
    }
    const onReady = (): void => setWebviewReady(true)
    wv.addEventListener('dom-ready', onReady)
    return () => wv.removeEventListener('dom-ready', onReady)
  }, [running])

  // When a frame is linked (or changes), drive the embedded ComfyUI to open it.
  // If the saved workflow tab opens cleanly, clear the hint (no sidebar step needed).
  useEffect(() => {
    if (!webviewReady || !linkedWorkflow || !webviewRef.current) return
    // One-frame: clear after attempting so a remount can't replay a stale workflow
    // and re-select the wrong frame's tab.
    webviewRef.current
      .executeJavaScript(openWorkflowScript(linkedWorkflow))
      .catch(() => {})
      .finally(() => setLinkedWorkflow(null))
  }, [webviewReady, linkedWorkflow, setLinkedWorkflow])

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

      <div className="relative flex-1">
        {running ? (
          <webview
            ref={webviewRef}
            src={url}
            partition="persist:comfyui"
            className="h-full w-full border-0 bg-white"
          />
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

        {run && run.outputs.length > 0 && (
          <CaptureStrip
            run={run}
            captured={captured}
            targetFrameName={activeFrame?.name ?? null}
            onCapture={onCapture}
            onDismiss={() => setRun(null)}
          />
        )}
      </div>
    </div>
  )
}

function CaptureStrip({
  run,
  captured,
  targetFrameName,
  onCapture,
  onDismiss,
}: {
  run: ComfyRun
  captured: Set<string>
  targetFrameName: string | null
  onCapture: (output: ComfyOutput) => void
  onDismiss: () => void
}): React.JSX.Element {
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 border-t border-border bg-panel/95 p-2 backdrop-blur">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] text-zinc-300">
          New outputs ·{' '}
          {targetFrameName ? (
            <>
              capture to <span className="font-medium text-white">Frame {targetFrameName}</span>
            </>
          ) : (
            <span className="text-amber-400">open a frame's workflow to capture</span>
          )}
        </span>
        <button
          onClick={onDismiss}
          className="rounded border border-border px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-surface"
        >
          Dismiss
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {run.outputs.map((output) => (
          <CaptureTile
            key={output.url}
            output={output}
            captured={captured.has(output.url)}
            disabled={!targetFrameName}
            onCapture={() => onCapture(output)}
          />
        ))}
      </div>
    </div>
  )
}

function CaptureTile({
  output,
  captured,
  disabled,
  onCapture,
}: {
  output: ComfyOutput
  captured: boolean
  disabled: boolean
  onCapture: () => void
}): React.JSX.Element {
  return (
    <div className="group relative h-24 w-24 shrink-0 overflow-hidden rounded border border-border bg-black/40">
      {output.kind === 'video' ? (
        <video src={output.url} muted preload="metadata" className="h-full w-full object-cover" />
      ) : (
        <img src={output.url} alt="" className="h-full w-full object-cover" />
      )}
      <button
        onClick={onCapture}
        disabled={disabled || captured}
        className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-not-allowed"
      >
        {captured ? '✓ Captured' : 'Update frame output'}
      </button>
      {captured && (
        <span className="absolute right-1 top-1 rounded bg-accent px-1 text-[9px] text-white">
          ✓
        </span>
      )}
    </div>
  )
}
