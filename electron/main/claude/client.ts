/**
 * The Claude engine. All Anthropic SDK usage lives here (engine-isolation rule,
 * mirroring comfy/client.ts) — no Anthropic specifics leak into IPC or UI code.
 * The API key is read from the encrypted credentials store and never leaves main.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { ClaudeContext, ClaudeSendInput, ClaudeStatus } from '@shared/types'
import type { ClaudeProposal } from '@shared/claudeActions'
import { resolveModel, DEFAULT_CLAUDE_MODEL } from '@shared/claudeModels'
import * as credentials from './credentials'
import { SYSTEM_PROMPT } from './prompt'
import { PROPOSE_TOOL, normalizeActions } from './tools'

/** The model used to validate a key (any current model works). */
export const CLAUDE_MODEL = DEFAULT_CLAUDE_MODEL

/** Abort a stream that goes completely silent this long — a dead connection, not thinking. */
const STREAM_IDLE_MS = 40_000

/** Callbacks the IPC layer wires to renderer pushes for a streaming turn. */
export interface TurnEmitter {
  delta(text: string): void
  proposal(proposal: ClaudeProposal): void
  done(text: string): void
  error(message: string): void
}

/** The currently streaming turn, so `cancelTurn` can abort it. */
let activeStream: ReturnType<Anthropic['messages']['stream']> | null = null

export function getStatus(): ClaudeStatus {
  return {
    configured: credentials.isConfigured(),
    encrypted: credentials.isEncryptionAvailable(),
  }
}

/**
 * Verify a key actually works before storing it, so a typo'd or revoked key never
 * gets saved and silently fails later. A cheap `models.retrieve` is enough to
 * exercise auth + model access.
 */
export async function setApiKey(key: string): Promise<ClaudeStatus> {
  const trimmed = key.trim()
  if (!trimmed) throw new Error('Enter an API key.')
  const probe = new Anthropic({ apiKey: trimmed })
  try {
    await probe.models.retrieve(CLAUDE_MODEL)
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      throw new Error('That API key was rejected by Anthropic.')
    }
    if (e instanceof Anthropic.PermissionDeniedError) {
      throw new Error(`That API key lacks access to ${CLAUDE_MODEL}.`)
    }
    throw new Error('Could not reach Anthropic to verify the key. Check your connection.')
  }
  credentials.setApiKey(trimmed)
  return getStatus()
}

export function clearApiKey(): ClaudeStatus {
  credentials.clearApiKey()
  return getStatus()
}

/** Render the volatile project snapshot as a compact text block for the user turn. */
function formatContext(ctx: ClaudeContext): string {
  const lines: string[] = ['[Project context]', `Current view: ${ctx.mode}`]
  lines.push(`ComfyUI reachable: ${ctx.comfyReachable ? 'yes' : 'no'}`)
  if (ctx.activeFrame) {
    const f = ctx.activeFrame
    lines.push(
      `Active frame: "${f.name}" (id ${f.id}) — ${f.inputCount} input(s), ${f.takeCount} take(s), workflow ${f.workflowReady ? 'ready' : 'not built'}`,
    )
  }

  // What the user explicitly attached — the strongest signal of what they mean.
  if (ctx.attachments.length > 0) {
    lines.push('User-attached context for THIS message (act on exactly these):')
    for (const at of ctx.attachments) {
      if (at.kind === 'items' && at.ids?.length) {
        const named = at.ids.map((id) => {
          const b = ctx.board.find((x) => x.id === id)
          return b ? `${b.type} "${b.name}" (id ${id})` : id
        })
        lines.push(`  - Selected: ${named.join(', ')}`)
      } else if (at.kind === 'spot') {
        lines.push(`  - Add new items near (${at.x}, ${at.y})`)
      }
    }
  }

  // The canvas, with geometry so the model can place/align/edit spatially.
  lines.push(`Canvas nodes (${ctx.board.length}):`)
  if (ctx.board.length === 0) {
    lines.push('  (empty)')
  } else {
    for (const it of ctx.board) {
      const where = it.parentId ? ` in layer ${it.parentId} (x/y relative)` : ''
      lines.push(
        `  - ${it.type} "${it.name}" id=${it.id} at (${it.x},${it.y}) ${it.width}x${it.height}${where}`,
      )
    }
  }

  lines.push(
    `Timeline frames (${ctx.frames.length}): ${
      ctx.frames.map((f) => `"${f.name}"`).join(', ') || 'none'
    }`,
  )
  lines.push(
    `Library assets (${ctx.assets.length}): ${
      ctx.assets
        .slice(0, 40)
        .map((a) => `"${a.name}" [${a.kind}] id=${a.id}`)
        .join(', ') || 'none'
    }`,
  )
  return lines.join('\n')
}

/** Convert chat history to Anthropic messages, folding context into the latest user turn. */
function toAnthropicMessages(input: ClaudeSendInput): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = input.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))
  // Ground the latest user turn with the current project snapshot.
  const lastUser = [...out].reverse().find((m) => m.role === 'user')
  if (lastUser && typeof lastUser.content === 'string') {
    lastUser.content = `${formatContext(input.context)}\n\n${lastUser.content}`
  }
  return out
}

/** Stream an assistant turn: streams text, and turns `propose_actions` tool calls into
 * proposals the user can apply. Runs a manual tool loop so it can keep the conversation
 * going after each proposal until the model finishes (`end_turn`). */
export async function runTurn(input: ClaudeSendInput, emit: TurnEmitter): Promise<void> {
  const apiKey = credentials.getApiKey()
  if (!apiKey) {
    emit.error('Claude is not connected. Add an API key first.')
    return
  }
  const client = new Anthropic({ apiKey })
  const model = resolveModel(input.model)
  const messages = toAnthropicMessages(input)
  // Running text across all tool rounds — authoritative for `done`, so a cancel or stall
  // always flushes everything received (not just whole completed rounds).
  let streamed = ''
  let stalled = false
  let proposalIndex = 0

  try {
    // Cap tool rounds so a misbehaving turn can't loop forever.
    for (let round = 0; round < 6; round++) {
      const stream = client.messages.stream({
        model: model.id,
        max_tokens: 16000,
        // Adaptive thinking where supported; omitted on models that reject it.
        ...(model.adaptiveThinking ? { thinking: { type: 'adaptive' as const } } : {}),
        // System prompt is stable → cache it; volatile context rides in the user turn.
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        tools: [PROPOSE_TOOL],
        messages,
      })
      activeStream = stream

      // Inactivity watchdog: a live stream emits events constantly (including thinking),
      // so silence means a dead connection. Reset on ANY event so long thinking pauses
      // don't trip it; abort if truly idle, turning a hang into a clear, retryable state.
      let idle: ReturnType<typeof setTimeout> | undefined
      const arm = (): void => {
        if (idle) clearTimeout(idle)
        idle = setTimeout(() => {
          stalled = true
          stream.abort()
        }, STREAM_IDLE_MS)
      }
      stream.on('streamEvent', arm)
      stream.on('text', (delta) => {
        streamed += delta
        emit.delta(delta)
      })
      arm()
      let final: Anthropic.Message
      try {
        final = await stream.finalMessage()
      } finally {
        if (idle) clearTimeout(idle)
      }

      const toolUses = final.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      )
      if (final.stop_reason !== 'tool_use' || toolUses.length === 0) break

      // Echo the assistant turn back verbatim (incl. thinking blocks) per the API contract.
      messages.push({ role: 'assistant', content: final.content })
      const results: Anthropic.ToolResultBlockParam[] = []
      for (const tu of toolUses) {
        if (tu.name === PROPOSE_TOOL.name) {
          const parsed = parseProposal(tu.input)
          if (parsed) {
            emit.proposal({
              id: `${input.turnId}:${proposalIndex++}`,
              turnId: input.turnId,
              summary: parsed.summary,
              actions: parsed.actions,
            })
            results.push({
              type: 'tool_result',
              tool_use_id: tu.id,
              content:
                'Proposal queued for the user to review and apply. It has NOT been applied — do not claim the canvas changed. Briefly tell the user what you proposed.',
            })
          } else {
            results.push({
              type: 'tool_result',
              tool_use_id: tu.id,
              content: 'That proposal had no valid actions. Reconsider and try again.',
              is_error: true,
            })
          }
        } else {
          results.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: 'Unknown tool.',
            is_error: true,
          })
        }
      }
      messages.push({ role: 'user', content: results })
    }
    emit.done(streamed)
  } catch (e) {
    if (e instanceof Anthropic.APIUserAbortError) {
      // User cancelled or the watchdog tripped: keep everything received. If a stall
      // produced nothing, surface it so the user knows to retry rather than seeing silence.
      if (streamed) emit.done(streamed)
      else if (stalled) emit.error('Claude stopped responding. Please try again.')
      else emit.done('')
      return
    }
    emit.error(e instanceof Error ? e.message : String(e))
  } finally {
    activeStream = null
  }
}

/** Validate a `propose_actions` tool input into a summary + actions, or null if empty. */
function parseProposal(
  input: unknown,
): { summary: string; actions: ReturnType<typeof normalizeActions> } | null {
  if (typeof input !== 'object' || input === null) return null
  const o = input as Record<string, unknown>
  const summary = typeof o.summary === 'string' ? o.summary : ''
  const actions = normalizeActions(o.actions)
  if (actions.length === 0) return null
  return { summary, actions }
}

/** Abort the in-flight turn, if any. */
export function cancelTurn(): void {
  activeStream?.abort()
}
