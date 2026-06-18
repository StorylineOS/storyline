import { useState } from 'react'
import { useClaudeStore } from '../../store/claudeStore'

/**
 * Shown in the Assistant panel when no Claude key is connected. Takes an Anthropic
 * API key, which the main process validates against Anthropic before storing it
 * (encrypted). The key never enters the renderer beyond this input.
 */
export function ClaudeSignIn(): React.JSX.Element {
  const setApiKey = useClaudeStore((s) => s.setApiKey)
  const busy = useClaudeStore((s) => s.busy)
  const error = useClaudeStore((s) => s.error)
  const status = useClaudeStore((s) => s.status)
  const [key, setKey] = useState('')

  const submit = async (): Promise<void> => {
    if (!key.trim() || busy) return
    const ok = await setApiKey(key.trim())
    if (ok) setKey('')
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-6">
      <div className="w-full max-w-xs text-center">
        <h2 className="text-sm font-semibold text-zinc-100">Connect Claude</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
          Paste an Anthropic API key. Claude helps you design frames, arrange layers, and set up
          ComfyUI workflows. The key is stored encrypted on this machine and never leaves it.
        </p>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit()
          }}
          placeholder="sk-ant-..."
          spellCheck={false}
          autoComplete="off"
          className="mt-4 w-full rounded border border-border bg-surface px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-accent"
        />
        <button
          onClick={() => void submit()}
          disabled={busy || !key.trim()}
          className="mt-2 w-full rounded bg-accent px-2 py-1.5 text-xs font-medium text-panel hover:brightness-110 disabled:opacity-40"
        >
          {busy ? 'Verifying…' : 'Connect'}
        </button>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        {status && !status.encrypted && (
          <p className="mt-2 text-[11px] text-amber-400">
            No OS keystore found — the key will be stored unencrypted on this device.
          </p>
        )}
        <button
          onClick={() =>
            void window.inlineStudio.shell.openExternal(
              'https://console.anthropic.com/settings/keys',
            )
          }
          className="mt-3 text-[11px] text-zinc-500 hover:text-accent"
        >
          Get an API key ↗
        </button>
      </div>
    </div>
  )
}
