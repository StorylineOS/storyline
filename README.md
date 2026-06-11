# Storyline

**A narrative-first desktop app for filmmakers, video artists, and visual creators — with [ComfyUI](https://github.com/comfyanonymous/ComfyUI) as an open generative render-farm.**

ComfyUI is the most capable generative engine there is (image, video, audio, LLM — every new model lands there first), but it forces you to think in **node graphs and execution order**. Filmmakers think in **shots, scenes, sequences, and time**. Storyline closes that gap: you work shot-by-shot on a timeline that looks like iMovie/Premiere, while ComfyUI quietly does the generation behind each shot.

> Status: **early development.** The foundation (projects, data model, app shell, ComfyUI-ready architecture) is in place. The shot/timeline/moodboard features are being built phase by phase — see [Roadmap](#roadmap).

---

## The core idea

A **Shot is not a file — it's a slot with a history of takes.** Filmmakers reshoot; every ComfyUI render becomes an immutable _take_ under a shot, and the timeline simply points at whichever take is the current "hero." This versioned-take model is the thing ComfyUI fundamentally lacks, and it's what the whole app is organised around:

```
Project → Sequence / Scene → Shot → Take[]
```

- **Project** — a portable `.storyline` folder you can move, back up, and share.
- **Sequence / Scene** — an ordered group of shots.
- **Shot** — the atomic unit; an image or video, generated from a ComfyUI workflow.
- **Take** — one immutable render of a shot. Generating again adds a take; nothing is overwritten.
- **Moodboard ↔ Timeline** — a shot is either pinned on a free canvas (moodboard) or placed in time (timeline).

---

## How ComfyUI fits in

You point Storyline at your own ComfyUI instance (`COMFYUI_URL`). Storyline does **not** bundle or manage ComfyUI — you run it yourself, locally or remote.

For each shot, Storyline exposes only the params that matter (prompt, seed, reference image, length, model), submits the job to ComfyUI's API, tracks progress live over its websocket, and pulls the output back in as a new take. An **"Open in ComfyUI"** escape hatch is always available for power users who want the full node graph.

---

## Tech stack

| Concern        | Choice                                             |
| -------------- | -------------------------------------------------- |
| Shell          | **Electron** (desktop, cross-platform)             |
| UI             | **React + TypeScript**, Tailwind CSS               |
| Build          | **electron-vite** (Vite, HMR)                      |
| State          | **Zustand**                                        |
| Project store  | **SQLite** (`better-sqlite3`) — one DB per project |
| Media / export | **ffmpeg** (bundled via `ffmpeg-static`)           |
| Moodboard      | **react-konva** canvas                             |

The architecture is strictly layered — **`renderer → IPC → main`** — with all filesystem, database, ComfyUI, and ffmpeg work isolated in the main process behind a typed IPC bridge. See [CLAUDE.md](CLAUDE.md) for the full engineering guide and conventions.

---

## Getting started

**Prerequisites:** Node.js 20.11+ (22 recommended). A running ComfyUI instance is only needed once shot generation lands (Phase 2).

```bash
# Install dependencies (rebuilds the native SQLite module for Electron)
npm install

# Configure your ComfyUI backend (optional for now)
cp .env.example .env        # then edit COMFYUI_URL

# Run the app in development (HMR)
npm run dev
```

> On macOS sandboxes that set `ELECTRON_RUN_AS_NODE=1`, launch the GUI with
> `env -u ELECTRON_RUN_AS_NODE npm run dev`.

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
  main/        app entry, SQLite, project lifecycle, IPC handlers
               (+ comfy/ and export/ in later phases)
  preload/     the typed contextBridge → window.storyline
src/
  shared/      domain types + the IPC contract (used by both processes)
  renderer/    React UI — stores, views, components
```

A project on disk:

```
MyFilm.storyline/
  project.db   (SQLite — the source of truth; saving is implicit)
  assets/      (imported library media)
  takes/       (generated ComfyUI outputs)
  thumbs/      (cached thumbnails / waveforms)
```

---

## Roadmap

- [x] **Phase 0 — Foundation:** Electron + React scaffold, code standards, security baseline, SQLite schema, project create/open/recents.
- [ ] **Phase 1 — Assets, Library & Moodboard:** import media, organise it, free-canvas moodboard.
- [ ] **Phase 2 — ComfyUI generation:** workflow templates, param editing, submit/track/collect takes, hero selection.
- [ ] **Phase 3 — Timeline, preview & export:** ordered shots, trim, preview player, ffmpeg export to MP4. _(MVP)_
- [ ] **Phase 4+ — NLE-grade:** multi-track audio, crop/transform, transitions, batch generation, collaboration.

---

## License

MIT
