# Storyline

**A narrative-first desktop app for filmmakers, video artists, and visual creators — with [ComfyUI](https://github.com/comfyanonymous/ComfyUI) as an open generative render-farm.**

ComfyUI is the most capable generative engine there is (image, video, audio, LLM — every new model lands there first), but it forces you to think in **node graphs and execution order**. Filmmakers think in **frames, scenes, sequences, and time**. Storyline closes that gap: you compose on a free-form node canvas and work frame-by-frame, while ComfyUI quietly does the generation behind each frame.

> Status: **active development.** The app shell, project model, the unified canvas, and the ComfyUI integration (link a workflow, feed inputs, capture outputs as takes) are working. Timeline/preview/export and NLE-grade editing are still being built — see [Roadmap](#roadmap).

---

## The core idea

A **Frame is not a file — it's a slot with a history of takes.** Filmmakers reshoot; every ComfyUI render becomes an immutable _take_ under a frame, and the chosen "hero" take is what flows downstream. This versioned-take model is the thing ComfyUI fundamentally lacks, and it's what the whole app is organised around:

```
Project → Sequence / Scene → Frame → Take[]
```

- **Project** — a portable `.storyline` folder you can move, back up, and share.
- **Sequence / Scene** — an ordered group of frames.
- **Frame** — the atomic unit; an image or video slot. Its inputs are library assets _or_ another frame's output; its renders are takes.
- **Take** — one immutable render of a frame. Generating again adds a take; nothing is overwritten.
- **Moodboard ↔ Timeline** — a frame is either pinned on the free-form canvas or surfaced in the Timeline panel. Same frame, different surface.

---

## The canvas ("Storyline")

The heart of the app is a **node canvas** (built on [React Flow](https://reactflow.dev)) where you assemble your film as a graph:

- **Frame nodes** — drop a library asset onto the canvas (or onto a frame) to set its input; a frame with several inputs becomes a carousel with a hero picker. Each frame carries an **Input** and **Output** handle.
- **Preview nodes** — wire a frame's Output into a Preview to see its takes (carousel + "set hero").
- **Refine / flow chaining** — wire a **Preview's output into another frame's Input**, and that frame uses the upstream frame's hero take as its input. Build A → Preview → B pipelines where regenerating A flows straight into B.
- **Layer** groups, **Text** notes (auto-sizing, colour/size/links via a floating toolbar), and visual frame↔frame links round out the canvas.

Canvas UX is Figma/Miro-flavoured: **marquee + multi-select** (⌘/Ctrl/Shift-drag), **copy / paste** (⌘C / ⌘V), **delete**, and **undo / redo** (⌘Z / ⌘⇧Z). A resizable left rail switches between the **Assets** library and a **Timeline** list of frames.

---

## How ComfyUI fits in

You point Storyline at your own ComfyUI instance — Storyline does **not** bundle or manage ComfyUI. The **Generate** tab embeds ComfyUI directly (so the full node graph is always one click away) and bridges it to your frames:

- **Connect** — paste your ComfyUI URL. Two paths are supported out of the box, with in-app guidance:
  - **Local GPU** — run ComfyUI with `--enable-cors-header` (needed for the embed to talk to it).
  - **Cloud GPU** — deploy ComfyUI on [RunPod](https://runpod.io) with the official template and paste the public URL. Any publicly hosted ComfyUI works too.
- **Link a workflow** to a frame — Storyline keeps a durable copy of each frame's workflow, uploads the frame's inputs, and **wires them into the workflow's `LoadImage` nodes** so the displayed input is the one ComfyUI loads.
- **Capture outputs** — finished renders are pulled back in as new takes; pick the hero, and it flows to any downstream frame.

---

## Tech stack

| Concern       | Choice                                                 |
| ------------- | ------------------------------------------------------ |
| Shell         | **Electron** (desktop, cross-platform)                 |
| UI            | **React + TypeScript**, Tailwind CSS                   |
| Build         | **electron-vite** (Vite, HMR)                          |
| State         | **Zustand** (small, feature-scoped stores)             |
| Project store | **SQLite** (`better-sqlite3`) — one DB per project     |
| Canvas        | **React Flow** (`@xyflow/react`)                       |
| ComfyUI       | embedded `<webview>` + HTTP/userdata API bridge        |
| Export        | file copy today; **ffmpeg** for video export (planned) |

The architecture is strictly layered — **`renderer → IPC → main`** — with all filesystem, database, and ComfyUI work isolated in the main process behind a typed IPC bridge. See [CLAUDE.md](CLAUDE.md) for the full engineering guide and conventions.

---

## Getting started

**Prerequisites:** Node.js 20.11+ (22 recommended). A running ComfyUI instance (local or remote) is needed to generate; everything else works without it.

```bash
# Install dependencies (rebuilds the native SQLite module for Electron)
npm install

# Configure a default ComfyUI backend (optional — also settable in-app)
cp .env.example .env        # then edit COMFYUI_URL

# Run the app in development (HMR)
npm run dev
```

> On macOS sandboxes that set `ELECTRON_RUN_AS_NODE=1`, launch the GUI with
> `env -u ELECTRON_RUN_AS_NODE npm run dev`.

To generate, start ComfyUI with CORS enabled and connect it on the Generate tab:

```bash
python main.py --enable-cors-header      # then paste http://127.0.0.1:8188 in-app
```

### Scripts

| Command             | What it does                                    |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Launch the app with hot-reload                  |
| `npm run build`     | Type-check + production build                   |
| `npm run typecheck` | Type-check the main + renderer projects         |
| `npm run lint`      | ESLint (zero warnings allowed)                  |
| `npm run test`      | Run unit tests (Vitest)                         |
| `npm run rebuild`   | Rebuild `better-sqlite3` against Electron's ABI |

---

## Project structure

```
electron/
  main/
    db/          SQLite schema + migrations
    project/     project lifecycle (.storyline folders, recents)
    ipc/         typed IPC handlers (Result-wrapped)
    comfy/       ComfyUI client — link/upload/capture, all Comfy knowledge here
    export/      output export (file copy today; ffmpeg later)
  preload/       the typed contextBridge → window.storyline
src/
  shared/        domain types + the IPC contract (used by both processes)
  renderer/      React UI — Zustand stores, feature-foldered views, components
```

A project on disk:

```
MyFilm.storyline/
  project.db   (SQLite — the source of truth; saving is implicit)
  assets/      (imported library media)
  takes/       (generated ComfyUI outputs)
  thumbs/      (cached thumbnails / waveforms)
  workflows/   (durable per-frame ComfyUI workflow copies)
```

---

## Roadmap

- [x] **Foundation** — Electron + React scaffold, code standards, security baseline, SQLite schema, project create/open/recents.
- [x] **Assets, Library & Canvas** — import/organise media, the free-form React Flow node canvas, frames/previews/layers/text, multi-select, copy-paste, undo/redo.
- [x] **ComfyUI generation** — embedded ComfyUI, link a workflow per frame, upload + wire inputs, capture outputs as takes, hero selection, refine/flow chaining between frames.
- [ ] **Timeline, preview & export** — ordered timeline, trim, preview player, ffmpeg export to MP4. _(MVP)_
- [ ] **NLE-grade** — multi-track audio, crop/transform, transitions, batch generation, collaboration.

---

## License

MIT
