/** IPC handlers for the Claude assistant: auth + a streaming chat turn. */
import { BrowserWindow } from 'electron'
import { IpcChannels } from '@shared/ipc'
import type {
  ClaudeStatus,
  ClaudeSendInput,
  ClaudeMessage,
  ClaudeContext,
  ClaudeDeltaEvent,
  ClaudeDoneEvent,
  ClaudeErrorEvent,
} from '@shared/types'
import { handle } from './handler'
import {
  getStatus,
  setApiKey,
  clearApiKey,
  runTurn,
  cancelTurn,
  type TurnEmitter,
} from '../claude/client'

/** Push an event to every renderer window (single-window app; mirrors assets store). */
function broadcast(channel: string, payload: unknown): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send(channel, payload)
}

/** Validate the untrusted renderer payload before it reaches the engine. */
function asSendInput(v: unknown): ClaudeSendInput {
  if (typeof v !== 'object' || v === null) throw new Error('Invalid request.')
  const o = v as Record<string, unknown>
  if (typeof o.turnId !== 'string' || o.turnId.length === 0) throw new Error('Invalid turn id.')
  if (!Array.isArray(o.messages)) throw new Error('Invalid messages.')
  const messages: ClaudeMessage[] = o.messages.map((m) => {
    const mm = m as Record<string, unknown>
    if ((mm.role !== 'user' && mm.role !== 'assistant') || typeof mm.content !== 'string') {
      throw new Error('Invalid message.')
    }
    return { role: mm.role, content: mm.content }
  })
  if (messages.length === 0) throw new Error('No message to send.')
  if (typeof o.context !== 'object' || o.context === null) throw new Error('Invalid context.')
  return {
    turnId: o.turnId,
    model: typeof o.model === 'string' ? o.model : undefined,
    messages,
    context: o.context as ClaudeContext,
  }
}

export function registerClaudeHandlers(): void {
  handle<[], ClaudeStatus>(IpcChannels.claude.status, () => getStatus())
  handle<[string], ClaudeStatus>(IpcChannels.claude.setApiKey, (key) => {
    if (typeof key !== 'string') throw new Error('Invalid API key.')
    return setApiKey(key)
  })
  handle<[], ClaudeStatus>(IpcChannels.claude.clearApiKey, () => clearApiKey())

  handle<[unknown], void>(IpcChannels.claude.send, (raw) => {
    const input = asSendInput(raw)
    const { turnId } = input
    const emit: TurnEmitter = {
      delta: (text) =>
        broadcast(IpcChannels.events.claudeDelta, { turnId, text } satisfies ClaudeDeltaEvent),
      proposal: (proposal) => broadcast(IpcChannels.events.claudeProposal, proposal),
      done: (text) =>
        broadcast(IpcChannels.events.claudeDone, { turnId, text } satisfies ClaudeDoneEvent),
      error: (error) =>
        broadcast(IpcChannels.events.claudeError, { turnId, error } satisfies ClaudeErrorEvent),
    }
    // Fire and forget: results stream back via events; the invoke resolves immediately.
    void runTurn(input, emit)
  })

  handle<[], void>(IpcChannels.claude.cancel, () => cancelTurn())
}
