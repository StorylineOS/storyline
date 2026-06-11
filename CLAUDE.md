# Storyline — Engineering Guide

Storyline is a **narrative-first desktop app for filmmakers** that uses **ComfyUI** as an open
generative render-farm. Creators work shot-by-shot on a timeline (think iMovie/Premiere), while
ComfyUI does the actual image/video/audio/LLM generation behind each shot.

> Read this file before changing code. It defines the architecture and the non-negotiable rules.

## Mental model (everything is organised around this)

```
Project → Sequence → Shot → Take[]
```

- **Project** — a portable `.storyline` folder (see Storage below).
- **Sequence / Scene** — an ordered group of shots.
- **Shot** — the atomic unit. **A Shot is a _slot with a history of takes_, never a single file.**
- **Take** — one immutable ComfyUI render of a shot. Generating again adds a new take; nothing is
  overwritten. The timeline points at the Shot's `heroTakeId` (the chosen take).
- **Moodboard ↔ Timeline** — a shot is either pinned on the free-canvas moodboard or placed in
  time on the timeline. Same shot, different surface.

If you're tempted to treat a shot as a file, stop — the take history is the core value Comfy lacks.

## Architecture

Electron, two processes, one direction of dependency: **`renderer → IPC → main`**.

- **Main process** (`electron/main/`) — owns all "trusted" work: filesystem, the project
  SQLite DB, the ComfyUI client, and ffmpeg. Node APIs live here only.
- **Preload** (`electron/preload/`) — the _only_ bridge. Exposes a typed, minimal surface on
  `window.storyline` via `contextBridge`. No raw `ipcRenderer`/channels leak to the renderer.
- **Renderer** (`src/renderer/`) — all React UI. Reaches the outside world _only_ through
  `window.storyline`. Never imports `electron`, `fs`, `path`, `better-sqlite3`, `ws`, or
  `fluent-ffmpeg` (ESLint enforces this).
- **Shared** (`src/shared/`) — types + the IPC contract imported by both processes.

### Directory map

```
electron/
  main/
    index.ts            app entry + BrowserWindow (security baseline)
    db/                 SQLite: schema.ts (tables+migrations), index.ts (open/close)
    project/            project lifecycle: store.ts (.storyline folders), recents.ts
    ipc/                handler.ts (Result wrapper), <feature>.ts handlers, index.ts (register)
    comfy/              [Phase 2] ComfyUI client + workflow templates — all Comfy knowledge here
    export/             [Phase 3] ffmpeg — all ffmpeg knowledge here
  preload/
    index.ts            contextBridge → window.storyline
src/
  shared/
    types.ts            domain types (Project/Sequence/Shot/Take/...)
    ipc.ts              IpcChannels + StorylineApi (the typed contract)
    result.ts           Result<T> = Ok | Err
  renderer/
    main.tsx, App.tsx
    store/              Zustand stores (feature-scoped: projectStore, ...)
    views/              feature-foldered screens (ProjectLauncher, Workspace, ...)
    components/         shared UI
```

### Storage — a project is a portable folder

```
MyFilm.storyline/
  project.db   (SQLite — source of truth; "save" is implicit)
  assets/      (imported library media, by id)
  takes/       (generated outputs from ComfyUI, by take id)
  thumbs/      (cached thumbnails / waveforms)
```

The recent-projects list lives in Electron `userData` (app-global), not in any project.

### ComfyUI integration (`electron/main/comfy/`, Phase 2)

`COMFYUI_URL` comes from an in-app setting (falling back to env, see `.env.example`). The flow:
import a workflow JSON → mark editable node inputs as params → on generate, inject params and
POST `/prompt` → track progress over the `/ws` websocket → pull output via `/view` into `takes/`
as a new take. "Open in ComfyUI" is an **escape hatch** that opens the URL in the OS browser for
power users; it is never the primary path.

## Code standards (non-negotiable)

- **TypeScript strict.** No implicit `any`, no `as any` to silence errors. `npm run typecheck`.
- **Typed IPC only.** Channels live in `src/shared/ipc.ts`; the preload implements `StorylineApi`;
  handlers use the `handle()` wrapper and return `Result<T>` — errors never cross the bridge raw.
- **Validate IPC input in main.** Renderer payloads are untrusted; check them before use.
- **Electron security baseline:** `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`. The one deliberate deviation: `webviewTag: true`, solely so the Generate tab
  can embed and drive the user's own local ComfyUI via a `<webview>` (we never load untrusted
  remote content there).
- **Layering rule** (ESLint-enforced): renderer must not import Node/Electron/main modules.
- **State.** Zustand stores are small and feature-scoped. Components render; stores + IPC do work.
- **Engine isolation.** All Comfy logic behind `comfy/`, all ffmpeg behind `export/`. No Comfy URLs
  or ffmpeg args in UI code — either engine must be mockable/swappable.
- **Files & naming.** Components `PascalCase.tsx`, hooks `useX.ts`, one component per file,
  feature-foldered views. Keep files under ~300 lines without a good reason.
- **Tests (Vitest).** Cover the logic that matters: Comfy param-mapping/templates, timeline-time
  math, DB migrations. UI is verified per-phase by running the app — don't chase view coverage.
- **Commits.** Conventional Commits (`feat:`, `fix:`, `chore:`), small and scoped. `lint` +
  `typecheck` run on pre-commit (husky + lint-staged).

## Commands

```
npm run dev         # launch the app (electron-vite, HMR)
npm run typecheck   # tsc on node + web projects
npm run lint        # eslint, zero warnings allowed
npm run test        # vitest
npm run build       # typecheck + production build
npm run rebuild     # rebuild better-sqlite3 against Electron (if native ABI errors)
```

## Where to add things

- New IPC call → add channel + signature in `src/shared/ipc.ts`, implement in
  `electron/main/ipc/<feature>.ts`, expose in `electron/preload/index.ts`.
- New screen → `src/renderer/views/<Feature>/`, plus a store in `src/renderer/store/` if it owns state.
- New Comfy workflow template → `electron/main/comfy/templates/`.
- New domain entity → type in `src/shared/types.ts` + table in `electron/main/db/schema.ts`
  (bump `SCHEMA_VERSION` and add a migration).
