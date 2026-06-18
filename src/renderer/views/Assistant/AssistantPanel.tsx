import { useEffect, useRef, useState } from 'react'
import type { ClaudeMessage } from '@shared/types'
import { describeAction, type ClaudeProposal } from '@shared/claudeActions'
import { CLAUDE_MODELS } from '@shared/claudeModels'
import { useClaudeStore, type ClaudeAttachment } from '../../store/claudeStore'
import { useUiStore } from '../../store/uiStore'
import { ClaudeLogo } from '../../components/ClaudeLogo'
import { ClaudeSignIn } from './ClaudeSignIn'

/**
 * The docked Claude assistant sidebar — persistent across Moodboard/Generate modes.
 * Shows sign-in until a key is connected, then a streaming chat with apply-able
 * proposal cards. Opened/closed from the Claude button in the workspace header.
 */
export function AssistantPanel(): React.JSX.Element {
  const status = useClaudeStore((s) => s.status)
  const loadStatus = useClaudeStore((s) => s.loadStatus)
  const clearApiKey = useClaudeStore((s) => s.clearApiKey)
  const init = useClaudeStore((s) => s.init)
  const clearChat = useClaudeStore((s) => s.clearChat)
  const hasChat = useClaudeStore((s) => s.messages.length > 0 || s.proposals.length > 0)

  useEffect(() => {
    void loadStatus()
    init()
  }, [loadStatus, init])

  const configured = status?.configured ?? false

  return (
    <div className="flex h-full flex-col bg-panel">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${configured ? 'bg-green-500' : 'bg-zinc-600'}`} />
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
            Assistant
          </span>
        </div>
        <div className="flex items-center gap-1">
          {configured && hasChat && (
            <button
              onClick={clearChat}
              title="Clear conversation"
              className="rounded px-1.5 py-0.5 text-[11px] text-zinc-500 hover:text-zinc-200"
            >
              Clear
            </button>
          )}
          {configured && (
            <button
              onClick={() => void clearApiKey()}
              title="Disconnect Claude"
              className="rounded px-1.5 py-0.5 text-[11px] text-zinc-500 hover:text-red-400"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1">{configured ? <Chat /> : <ClaudeSignIn />}</div>
    </div>
  )
}

function Chat(): React.JSX.Element {
  const messages = useClaudeStore((s) => s.messages)
  const streamingText = useClaudeStore((s) => s.streamingText)
  const proposals = useClaudeStore((s) => s.proposals)
  const sending = useClaudeStore((s) => s.sending)
  const error = useClaudeStore((s) => s.error)
  const model = useClaudeStore((s) => s.model)
  const setModel = useClaudeStore((s) => s.setModel)
  const send = useClaudeStore((s) => s.send)
  const cancel = useClaudeStore((s) => s.cancel)
  const attachments = useClaudeStore((s) => s.attachments)
  const attachSelection = useClaudeStore((s) => s.attachSelection)
  const attachSpot = useClaudeStore((s) => s.attachSpot)
  const removeAttachment = useClaudeStore((s) => s.removeAttachment)
  const selCount = useUiStore((s) => s.canvasSelection.length)
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Keep the latest content in view as it streams / cards appear.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, streamingText, proposals])

  const submit = (): void => {
    const text = draft.trim()
    if (!text || sending) return
    setDraft('')
    void send(text)
  }

  const empty = messages.length === 0 && streamingText === null && proposals.length === 0

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {empty ? (
          <div className="px-1 pt-6 text-center text-xs leading-relaxed text-zinc-500">
            Ask Claude to help design your story. Try:
            <ul className="mt-2 space-y-1 text-left text-zinc-400">
              <li>· "Plan a 3-frame opening sequence."</li>
              <li>· "Add layers to organize this board."</li>
              <li>· "What ComfyUI nodes fit this frame?"</li>
            </ul>
          </div>
        ) : (
          messages.map((m, i) => <Bubble key={i} message={m} />)
        )}
        {sending && !streamingText && <ThinkingIndicator />}
        {streamingText ? (
          <Bubble message={{ role: 'assistant', content: streamingText }} streaming />
        ) : null}
        {proposals.map((p) => (
          <ProposalCard key={p.id} proposal={p} />
        ))}
        {error && (
          <p className="rounded bg-red-500/10 px-2 py-1.5 text-[11px] text-red-400">{error}</p>
        )}
      </div>

      <div className="border-t border-border p-2">
        {/* Attached context chips */}
        {attachments.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {attachments.map((a) => (
              <AttachmentChip key={a.id} attachment={a} onRemove={() => removeAttachment(a.id)} />
            ))}
          </div>
        )}

        {/* Attach-from-canvas controls */}
        <div className="mb-1.5 flex items-center gap-1">
          <button
            onClick={attachSelection}
            disabled={selCount === 0}
            title="Attach the current canvas selection as context"
            className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px] text-zinc-300 hover:bg-surface disabled:opacity-40"
          >
            <PlusIcon />
            Selection{selCount > 0 ? ` (${selCount})` : ''}
          </button>
          <button
            onClick={attachSpot}
            title="Attach the current canvas spot — tells Claude where to add new items"
            className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px] text-zinc-300 hover:bg-surface"
          >
            <PlusIcon />
            Spot
          </button>
        </div>

        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          rows={2}
          placeholder="Ask the assistant…"
          className="w-full resize-none rounded border border-border bg-surface px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-accent"
        />
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            title="Model"
            className="rounded border border-border bg-surface px-1.5 py-1 text-[11px] text-zinc-300 outline-none focus:border-accent"
          >
            {CLAUDE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          {sending ? (
            <button
              onClick={cancel}
              className="rounded border border-border px-3 py-1 text-xs text-zinc-300 hover:bg-surface"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!draft.trim()}
              className="rounded bg-accent px-3 py-1 text-xs font-medium text-white hover:brightness-110 disabled:opacity-40"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** A proposed batch of canvas actions the user can apply or dismiss. */
function ProposalCard({ proposal }: { proposal: ClaudeProposal }): React.JSX.Element {
  const applyProposal = useClaudeStore((s) => s.applyProposal)
  const dismissProposal = useClaudeStore((s) => s.dismissProposal)
  const applying = useClaudeStore((s) => s.applyingId === proposal.id)
  const progress = useClaudeStore((s) => s.applyProgress)

  return (
    <div className="rounded-lg border border-accent/40 bg-accent/5 p-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-accent">
        <span className={`h-1.5 w-1.5 rounded-full bg-accent ${applying ? 'animate-pulse' : ''}`} />
        {applying && progress ? (
          <span>
            Working… {Math.min(progress.done + 1, progress.total)}/{progress.total}
          </span>
        ) : (
          <span>
            Proposed plan · {proposal.actions.length} action
            {proposal.actions.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {applying && progress?.label ? (
        <p className="mt-1 text-xs text-zinc-300">{progress.label}…</p>
      ) : (
        <>
          {proposal.summary && (
            <p className="mt-1 text-xs leading-relaxed text-zinc-300">{proposal.summary}</p>
          )}
          <ul className="mt-1.5 space-y-0.5 text-[11px] text-zinc-500">
            {proposal.actions.slice(0, 8).map((a, i) => (
              <li key={i}>· {describeAction(a)}</li>
            ))}
            {proposal.actions.length > 8 && <li>· …and {proposal.actions.length - 8} more</li>}
          </ul>
        </>
      )}

      <div className="mt-2 flex justify-end gap-1.5">
        <button
          onClick={() => dismissProposal(proposal.id)}
          disabled={applying}
          className="rounded border border-border px-2.5 py-1 text-[11px] text-zinc-400 hover:bg-surface disabled:opacity-40"
        >
          Dismiss
        </button>
        <button
          onClick={() => void applyProposal(proposal.id)}
          disabled={applying}
          className="rounded bg-accent px-2.5 py-1 text-[11px] font-medium text-white hover:brightness-110 disabled:opacity-40"
        >
          {applying ? 'Working…' : 'Apply'}
        </button>
      </div>
    </div>
  )
}

function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: ClaudeAttachment
  onRemove: () => void
}): React.JSX.Element {
  const icon = attachment.kind === 'spot' ? '📍' : '◳'
  return (
    <span className="flex max-w-[180px] items-center gap-1 rounded-full border border-accent/40 bg-accent/10 py-0.5 pl-2 pr-1 text-[10px] text-zinc-200">
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{attachment.label}</span>
      <button
        onClick={onRemove}
        title="Remove"
        className="shrink-0 rounded-full px-1 text-zinc-400 hover:text-red-400"
      >
        ×
      </button>
    </span>
  )
}

function PlusIcon(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className="h-3 w-3"
    >
      <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" />
      <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
    </svg>
  )
}

/** Playful "Claude is working" status: a spinning mark + cycling verbs. */
const THINKING_WORDS = ['Thinking', 'Puffering', 'Clauding', 'Pondering', 'Sketching', 'Composing']

function ThinkingIndicator(): React.JSX.Element {
  const [word, setWord] = useState(0)
  const [dots, setDots] = useState(1)
  useEffect(() => {
    const w = setInterval(() => setWord((n) => (n + 1) % THINKING_WORDS.length), 1500)
    const d = setInterval(() => setDots((n) => (n % 3) + 1), 420)
    return () => {
      clearInterval(w)
      clearInterval(d)
    }
  }, [])
  return (
    <div className="flex items-center gap-2 px-1 text-xs text-zinc-400">
      <ClaudeLogo size={16} className="animate-[spin_2.4s_linear_infinite] text-[#D97757]" />
      <span>
        {THINKING_WORDS[word]}
        {'.'.repeat(dots)}
      </span>
    </div>
  )
}

function Bubble({
  message,
  streaming,
}: {
  message: ClaudeMessage
  streaming?: boolean
}): React.JSX.Element {
  const isUser = message.role === 'user'
  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className={`max-w-[88%] whitespace-pre-wrap rounded-lg px-2.5 py-1.5 text-xs leading-relaxed ${
          isUser ? 'bg-accent/20 text-zinc-100' : 'bg-surface text-zinc-200'
        }`}
      >
        {message.content}
        {streaming && <span className="ml-0.5 inline-block animate-pulse text-accent">▋</span>}
      </div>
    </div>
  )
}
