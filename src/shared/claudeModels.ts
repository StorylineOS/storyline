/** The models the user can pick in the assistant chat. Kept small and adaptive-thinking
 * friendly. `id` is the exact Anthropic model string; `label` is shown in the UI. */
export interface ClaudeModelOption {
  id: string
  label: string
  /** Whether the model accepts `thinking: { type: 'adaptive' }` (else thinking is omitted). */
  adaptiveThinking: boolean
}

export const CLAUDE_MODELS: ClaudeModelOption[] = [
  { id: 'claude-opus-4-8', label: 'Opus 4.8', adaptiveThinking: true },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', adaptiveThinking: true },
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5', adaptiveThinking: false },
]

export const DEFAULT_CLAUDE_MODEL = CLAUDE_MODELS[0].id

/** The chosen model if valid, else the default. */
export function resolveModel(id: string | undefined): ClaudeModelOption {
  return CLAUDE_MODELS.find((m) => m.id === id) ?? CLAUDE_MODELS[0]
}
