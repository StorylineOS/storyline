/**
 * The ComfyUI workflow-authoring "skill": a curated, versioned guidance block that makes
 * Claude generate valid, runnable ComfyUI workflows. It's a stable string (no per-turn
 * interpolation) so it stays prompt-cache friendly; improve it over time by editing here
 * and bumping COMFY_SKILL_VERSION. Per-user specifics (installed nodes/models, past
 * working graphs) are NOT baked in here — the model fetches those via the read-only tools.
 */
export const COMFY_SKILL_VERSION = 1

export const COMFY_SKILL = `# ComfyUI workflow authoring

You can build a frame's ComfyUI workflow by emitting a \`starterGraph\` in a \`suggestWorkflow\` action. Follow this exactly — workflows that reference nodes or model files that aren't installed will fail to load.

## Procedure (do this every time, before emitting a starterGraph)
1. Call **get_comfy_capabilities** to get the installed node types and model files. Only use node types from that list, and only use model filenames (checkpoints, loras, vae, …) from that list — never invent names.
2. Call **recall_workflows** with the frame's intent. If a past working graph matches, adapt it instead of starting blank.
3. Call **lookup_comfy_nodes** for any node whose inputs/widgets you're unsure of, so you wire sockets and \`widgets_values\` correctly.
4. If the frame already has an input image, wire the existing **LoadImage** node rather than adding a new one (the app repoints it at the frame's input automatically). Add a LoadImage only if none exists and the workflow needs an image input.
5. Emit the graph. Keep it minimal and valid. If you cannot confirm a needed node/model exists, give text guidance instead of a broken graph.

## The graph JSON shape (litegraph, version 0.4)
\`\`\`json
{
  "last_node_id": <int>, "last_link_id": <int>,
  "nodes": [
    { "id": 1, "type": "<NodeType>", "pos": [x, y], "size": [w, h], "flags": {}, "order": 0, "mode": 0,
      "inputs": [{ "name": "model", "type": "MODEL", "link": 5 }],
      "outputs": [{ "name": "LATENT", "type": "LATENT", "links": [7] }],
      "properties": {}, "widgets_values": [ ... ] }
  ],
  "links": [ [<linkId>, <fromNodeId>, <fromSlot>, <toNodeId>, <toSlot>, "<type>"] ],
  "groups": [], "config": {}, "extra": {}, "version": 0.4
}
\`\`\`
Rules that make a graph valid:
- Every link in the top-level \`links\` array MUST also be reflected on the nodes: the source node's matching \`outputs[].links\` includes that linkId, and the target node's matching \`inputs[].link\` equals that linkId.
- \`widgets_values\` is a positional array matching the node's widget inputs in order (use lookup_comfy_nodes to get the order). For a model loader, the model filename is a widget value.
- Give each node a distinct \`id\`; keep \`last_node_id\`/\`last_link_id\` ≥ the max used.

## Core recipe — text-to-image (adapt node/model names to what's installed)
CheckpointLoaderSimple(ckpt_name) → its MODEL→KSampler.model, its CLIP→two CLIPTextEncode (positive + negative) → their CONDITIONING→KSampler.positive/negative; EmptyLatentImage→KSampler.latent_image; KSampler.LATENT→VAEDecode.samples; CheckpointLoaderSimple.VAE→VAEDecode.vae; VAEDecode.IMAGE→SaveImage.images.

## Core recipe — image-to-image
LoadImage(IMAGE)→VAEEncode.pixels; CheckpointLoaderSimple.VAE→VAEEncode.vae; VAEEncode.LATENT→KSampler.latent_image (set KSampler denoise < 1.0); rest as text-to-image.

Prefer well-known core nodes (CheckpointLoaderSimple, CLIPTextEncode, KSampler, EmptyLatentImage, VAEDecode, VAEEncode, LoadImage, SaveImage) unless the user asks for something a custom node provides and that node is installed.`
