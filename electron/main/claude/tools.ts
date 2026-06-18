/**
 * The single tool Claude uses to PROPOSE design actions. The model never mutates the
 * project — it calls `propose_actions`, the loop records the batch, and the renderer
 * applies it on the user's approval. `normalizeActions` defensively validates the
 * model's output into the shared `ClaudeAction` union before it leaves the main process.
 */
import type Anthropic from '@anthropic-ai/sdk'
import type { ClaudeAction } from '@shared/claudeActions'

/** Read-only: the user's installed ComfyUI node types + model files. */
export const GET_CAPABILITIES_TOOL: Anthropic.Tool = {
  name: 'get_comfy_capabilities',
  description:
    "Return the user's installed ComfyUI node type names and model files by category " +
    '(checkpoints, loras, vae, controlnet, upscale_models, ...). Call this BEFORE authoring any ' +
    'workflow so you only reference nodes and model filenames that actually exist. Returns names ' +
    'only — use lookup_comfy_nodes for a node’s input/output schema.',
  input_schema: { type: 'object', properties: {}, required: [] },
}

/** Read-only: input/output schema for specific node types. */
export const LOOKUP_NODES_TOOL: Anthropic.Tool = {
  name: 'lookup_comfy_nodes',
  description:
    'Return the exact input/output schema for the named ComfyUI node types so you wire sockets ' +
    'and widgets correctly. Pass only the handful of node types you intend to use.',
  input_schema: {
    type: 'object',
    properties: { names: { type: 'array', items: { type: 'string' } } },
    required: ['names'],
  },
}

/** Read-only: past workflows that worked for similar frame intents (usage memory). */
export const RECALL_WORKFLOWS_TOOL: Anthropic.Tool = {
  name: 'recall_workflows',
  description:
    'Return past ComfyUI workflows that worked for similar frame intents in this project. Call ' +
    'this before authoring a workflow; if a past graph matches, adapt it instead of starting blank.',
  input_schema: {
    type: 'object',
    properties: { intent: { type: 'string', description: 'What the new frame/workflow is for.' } },
    required: ['intent'],
  },
}

export const PROPOSE_TOOL: Anthropic.Tool = {
  name: 'propose_actions',
  description: `Propose a batch of canvas/design actions for the user to review and apply with one click.

IMPORTANT: calling this does NOT change the project. It only queues a proposal for the user's approval — never claim the actions were applied. Use it whenever the user asks you to create or arrange frames, layers, previews, or wiring.

Refs: address each NEW node with a short symbolic "ref" you choose (e.g. "f1", "sky"). Later actions in the same batch reference that ref. A ref may also be a real existing id from the project context.

Layout: the canvas uses pixel coordinates. Space frames ~360px apart horizontally; size layers to comfortably contain their children and place them behind (lower) the frames they group.`,
  input_schema: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: 'One or two sentences describing the plan, addressed to the user.',
      },
      actions: {
        type: 'array',
        description: 'The ordered actions to apply.',
        items: {
          type: 'object',
          properties: {
            kind: {
              type: 'string',
              enum: [
                'addFrame',
                'addLayer',
                'addPreview',
                'addText',
                'editItem',
                'connect',
                'renameFrame',
                'nestInLayer',
                'suggestWorkflow',
              ],
            },
            ref: { type: 'string', description: 'Symbolic id for a node this action creates.' },
            name: { type: 'string' },
            fromAssetId: { type: 'string', description: 'Library asset id to seed a frame from.' },
            color: { type: 'string', description: 'Hex color for a layer, e.g. "#60a5fa".' },
            x: { type: 'number' },
            y: { type: 'number' },
            width: { type: 'number' },
            height: { type: 'number' },
            text: { type: 'string', description: 'Text content for an addText / editItem.' },
            fromRef: { type: 'string' },
            toRef: { type: 'string' },
            frameRef: { type: 'string' },
            itemRef: { type: 'string', description: 'A node to edit/move/nest (ref or real id).' },
            layerRef: {
              type: 'string',
              description: 'Layer to place a frame/preview inside (then x/y are relative to it).',
            },
            guidance: {
              type: 'string',
              description: 'Plain-language explanation of the workflow / node setup.',
            },
            starterGraph: {
              type: 'object',
              description:
                'Optional ComfyUI workflow JSON (litegraph format with a top-level `nodes` array) to seed into the frame. Keep it minimal and valid; omit it if unsure and rely on guidance.',
            },
          },
          required: ['kind'],
        },
      },
    },
    required: ['summary', 'actions'],
  },
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}
function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/** Validate the model's raw actions array into well-formed ClaudeActions (drops invalid). */
export function normalizeActions(raw: unknown): ClaudeAction[] {
  if (!Array.isArray(raw)) return []
  const out: ClaudeAction[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const o = item as Record<string, unknown>
    switch (o.kind) {
      case 'addFrame': {
        const ref = str(o.ref)
        if (!ref) break
        out.push({
          kind: 'addFrame',
          ref,
          name: str(o.name),
          fromAssetId: str(o.fromAssetId),
          layerRef: str(o.layerRef),
          x: num(o.x, 0),
          y: num(o.y, 0),
        })
        break
      }
      case 'addLayer': {
        const ref = str(o.ref)
        if (!ref) break
        out.push({
          kind: 'addLayer',
          ref,
          name: str(o.name) ?? 'Layer',
          color: str(o.color),
          x: num(o.x, 0),
          y: num(o.y, 0),
          width: typeof o.width === 'number' ? o.width : undefined,
          height: typeof o.height === 'number' ? o.height : undefined,
        })
        break
      }
      case 'addPreview': {
        const ref = str(o.ref)
        if (!ref) break
        out.push({
          kind: 'addPreview',
          ref,
          layerRef: str(o.layerRef),
          x: num(o.x, 0),
          y: num(o.y, 0),
        })
        break
      }
      case 'addText': {
        const ref = str(o.ref)
        const text = str(o.text)
        if (!ref || !text) break
        out.push({ kind: 'addText', ref, text, x: num(o.x, 0), y: num(o.y, 0) })
        break
      }
      case 'editItem': {
        const itemRef = str(o.itemRef)
        if (!itemRef) break
        out.push({
          kind: 'editItem',
          itemRef,
          x: typeof o.x === 'number' ? o.x : undefined,
          y: typeof o.y === 'number' ? o.y : undefined,
          width: typeof o.width === 'number' ? o.width : undefined,
          height: typeof o.height === 'number' ? o.height : undefined,
          name: str(o.name),
          color: str(o.color),
          text: str(o.text),
        })
        break
      }
      case 'connect': {
        const fromRef = str(o.fromRef)
        const toRef = str(o.toRef)
        if (!fromRef || !toRef) break
        out.push({ kind: 'connect', fromRef, toRef })
        break
      }
      case 'renameFrame': {
        const frameRef = str(o.frameRef)
        const name = str(o.name)
        if (!frameRef || !name) break
        out.push({ kind: 'renameFrame', frameRef, name })
        break
      }
      case 'nestInLayer': {
        const itemRef = str(o.itemRef)
        const layerRef = str(o.layerRef)
        if (!itemRef || !layerRef) break
        out.push({ kind: 'nestInLayer', itemRef, layerRef })
        break
      }
      case 'suggestWorkflow': {
        const frameRef = str(o.frameRef)
        if (!frameRef) break
        const graph =
          typeof o.starterGraph === 'object' &&
          o.starterGraph !== null &&
          !Array.isArray(o.starterGraph)
            ? (o.starterGraph as Record<string, unknown>)
            : undefined
        out.push({
          kind: 'suggestWorkflow',
          frameRef,
          guidance: str(o.guidance),
          starterGraph: graph,
        })
        break
      }
      default:
        break
    }
  }
  return out
}
