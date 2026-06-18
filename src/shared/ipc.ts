/**
 * The single typed contract for the renderer ↔ main IPC bridge.
 *
 * - `IpcChannels` are the only channel strings allowed (no stringly-typed
 *   `invoke('something')` scattered around — see CLAUDE.md).
 * - `StorylineApi` is the exact surface exposed on `window.storyline` by the
 *   preload. The renderer imports this type; the main process implements it.
 */
import type {
  Project,
  RecentProject,
  Asset,
  AssetFolder,
  MoodboardItem,
  MoodboardConnector,
  MoodboardSnapshot,
  MoodboardItemData,
  Frame,
  Take,
  FrameInput,
  AppSettings,
  ComfyStatus,
  ComfyOutput,
  ComfyRun,
  ExportResult,
  ProjectMediaDirs,
} from './types'
import type { Result } from './result'

export const IpcChannels = {
  project: {
    create: 'project:create',
    open: 'project:open',
    openDialog: 'project:openDialog',
    listRecent: 'project:listRecent',
    current: 'project:current',
    mediaDirs: 'project:mediaDirs',
  },
  clipboard: {
    writeText: 'clipboard:writeText',
  },
  assets: {
    importDialog: 'assets:importDialog',
    list: 'assets:list',
    delete: 'assets:delete',
  },
  folders: {
    list: 'folders:list',
    create: 'folders:create',
    rename: 'folders:rename',
    delete: 'folders:delete',
  },
  frames: {
    list: 'frames:list',
    importAsFrames: 'frames:importAsFrames',
    addFromAsset: 'frames:addFromAsset',
    rename: 'frames:rename',
    reorder: 'frames:reorder',
    delete: 'frames:delete',
    clone: 'frames:clone',
    unlink: 'frames:unlink',
    setHero: 'frames:setHero',
    listTakes: 'frames:listTakes',
    heroTakes: 'frames:heroTakes',
    listInputs: 'frames:listInputs',
    addInput: 'frames:addInput',
    addSourceInput: 'frames:addSourceInput',
    removeInput: 'frames:removeInput',
    reorderInputs: 'frames:reorderInputs',
    listAllTakes: 'frames:listAllTakes',
    deleteTake: 'frames:deleteTake',
  },
  comfy: {
    status: 'comfy:status',
    linkFrame: 'comfy:linkFrame',
    uploadInputs: 'comfy:uploadInputs',
    pullWorkflow: 'comfy:pullWorkflow',
    saveLiveWorkflow: 'comfy:saveLiveWorkflow',
    pushWorkflow: 'comfy:pushWorkflow',
    pullLatest: 'comfy:pullLatest',
    latestRun: 'comfy:latestRun',
    captureOutput: 'comfy:captureOutput',
  },
  settings: {
    get: 'settings:get',
    setComfyUrl: 'settings:setComfyUrl',
  },
  export: {
    exportFrames: 'export:exportFrames',
  },
  moodboard: {
    list: 'moodboard:list',
    addAsset: 'moodboard:addAsset',
    addText: 'moodboard:addText',
    addFrameFromAsset: 'moodboard:addFrameFromAsset',
    addEmptyFrame: 'moodboard:addEmptyFrame',
    addFrameItem: 'moodboard:addFrameItem',
    addPreview: 'moodboard:addPreview',
    addLayer: 'moodboard:addLayer',
    updateItem: 'moodboard:updateItem',
    deleteItem: 'moodboard:deleteItem',
    importAndPlace: 'moodboard:importAndPlace',
    createConnector: 'moodboard:createConnector',
    deleteConnector: 'moodboard:deleteConnector',
    replaceBoard: 'moodboard:replaceBoard',
  },
  dialog: {
    pickDirectory: 'dialog:pickDirectory',
  },
  shell: {
    openExternal: 'shell:openExternal',
  },
  events: {
    /** Main → renderer: the asset library changed (e.g. a video poster/transcode is ready). */
    libraryChanged: 'events:libraryChanged',
  },
} as const

/** Geometry/content fields a moodboard item update may change. */
export interface MoodboardItemPatch {
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  zIndex?: number
  data?: MoodboardItemData
  /** Containing layer id, or null to detach from any layer. */
  parentId?: string | null
}

export interface CreateFolderInput {
  name: string
  /** Parent folder id, or null for a root-level folder. */
  parentId: string | null
}

export interface CreateProjectInput {
  /** Display name; also used to derive the `.storyline` folder name. */
  name: string
  /** Absolute parent directory the `.storyline` folder is created in. */
  parentDir: string
}

/** The API surface the preload exposes on `window.storyline`. */
export interface StorylineApi {
  project: {
    create(input: CreateProjectInput): Promise<Result<Project>>
    /** Open a `.storyline` folder by absolute path. */
    open(path: string): Promise<Result<Project>>
    /** Show a native folder picker and open the chosen project. */
    openDialog(): Promise<Result<Project | null>>
    listRecent(): Promise<Result<RecentProject[]>>
    current(): Promise<Result<Project | null>>
    /** Absolute input/output dirs of the open project, for sharing with ComfyUI. */
    mediaDirs(): Promise<Result<ProjectMediaDirs>>
  }
  clipboard: {
    writeText(text: string): Promise<Result<void>>
  }
  assets: {
    /**
     * Show a native multi-file picker, copy chosen media into the project's library
     * under `folderId` (null = root), and return the new rows.
     */
    importDialog(folderId: string | null): Promise<Result<Asset[]>>
    /** All assets in the open project, newest first. */
    list(): Promise<Result<Asset[]>>
    /** Delete an asset (file + row); blocked if used by a frame. */
    delete(assetId: string): Promise<Result<void>>
  }
  folders: {
    /** All asset folders in the open project. */
    list(): Promise<Result<AssetFolder[]>>
    create(input: CreateFolderInput): Promise<Result<AssetFolder>>
    rename(id: string, name: string): Promise<Result<AssetFolder>>
    /** Delete a folder; its assets and subfolders move up to the parent. */
    delete(id: string): Promise<Result<void>>
  }
  frames: {
    /** All frames in the open project, in order. */
    list(): Promise<Result<Frame[]>>
    /** Import media via dialog and create a frame per file. */
    importAsFrames(): Promise<Result<Frame[]>>
    /** Create a frame from an existing library asset. */
    addFromAsset(assetId: string): Promise<Result<Frame>>
    rename(id: string, name: string): Promise<Result<Frame>>
    /** Persist a new left-to-right ordering. */
    reorder(orderedIds: string[]): Promise<Result<void>>
    delete(id: string): Promise<Result<void>>
    /** Duplicate a frame (its inputs + stored workflow); the clone starts unlinked. */
    clone(id: string): Promise<Result<Frame>>
    /** Detach the frame's ComfyUI workflow link. */
    unlink(id: string): Promise<Result<Frame>>
    /** Choose which take is the frame's Output (null clears it). */
    setHero(id: string, takeId: string | null): Promise<Result<Frame>>
    /** The frame's generated takes, newest first. */
    listTakes(frameId: string): Promise<Result<Take[]>>
    /** The hero (Output) take of every frame that has one. */
    heroTakes(): Promise<Result<Take[]>>
    /** All frame inputs across the project (group by frameId in the renderer). */
    listInputs(): Promise<Result<FrameInput[]>>
    /** Append a library asset as an input of the frame. */
    addInput(frameId: string, assetId: string): Promise<Result<FrameInput>>
    /** Link another frame's output as an input (resolves to its hero take). */
    addSourceInput(frameId: string, sourceFrameId: string): Promise<Result<FrameInput>>
    /** Remove an input; refused if it's the frame's last input. */
    removeInput(frameId: string, assetId: string): Promise<Result<void>>
    /** Persist a new input ordering for the frame. */
    reorderInputs(frameId: string, orderedAssetIds: string[]): Promise<Result<void>>
    /** All takes across the project (group by frameId in the renderer). */
    listAllTakes(): Promise<Result<Take[]>>
    /** Delete a generated take (clears it as hero if it was). */
    deleteTake(takeId: string): Promise<Result<void>>
  }
  comfy: {
    /** Is the configured ComfyUI reachable? */
    status(): Promise<Result<ComfyStatus>>
    /** Create/ensure this frame's linked ComfyUI workflow; returns the updated frame. */
    linkFrame(frameId: string): Promise<Result<Frame>>
    /** Upload the frame's input assets to ComfyUI (cloud-safe); returns stored names. */
    uploadInputs(frameId: string): Promise<Result<string[]>>
    /** Pull the frame's workflow from ComfyUI into the project copy; true if changed. */
    pullWorkflow(frameId: string): Promise<Result<boolean>>
    /**
     * Capture the live (possibly unsaved) graph serialized off the ComfyUI canvas into
     * the project copy. Returns the updated frame if anything changed, else null.
     */
    saveLiveWorkflow(frameId: string, workflow: unknown): Promise<Result<Frame | null>>
    /** Push the project's copy of the frame's workflow to ComfyUI. */
    pushWorkflow(frameId: string): Promise<Result<void>>
    /** Pull ComfyUI's latest output and attach it to the frame as its Output take. */
    pullLatest(frameId: string): Promise<Result<Take>>
    /** The most recent ComfyUI run + all its output files (for the capture strip). */
    latestRun(): Promise<Result<ComfyRun | null>>
    /** Download a specific ComfyUI output and attach it to the frame as a take. */
    captureOutput(frameId: string, output: ComfyOutput): Promise<Result<Take>>
  }
  settings: {
    get(): Promise<Result<AppSettings>>
    setComfyUrl(url: string): Promise<Result<AppSettings>>
  }
  export: {
    /** Pick a folder and write each frame's Output in order; null if cancelled. */
    exportFrames(): Promise<Result<ExportResult | null>>
  }
  moodboard: {
    /** The full board (items + connectors) for the open project. */
    list(): Promise<Result<MoodboardSnapshot>>
    /** Place an existing library asset on the board at (x, y). */
    addAsset(assetId: string, x: number, y: number): Promise<Result<MoodboardItem>>
    /** Add a new editable text item at (x, y). */
    addText(x: number, y: number): Promise<Result<MoodboardItem>>
    /** Create a frame from a library asset AND place a frame node on the canvas. */
    addFrameFromAsset(assetId: string, x: number, y: number): Promise<Result<MoodboardItem>>
    /** Create an empty frame AND place a frame node on the canvas at (x, y). */
    addEmptyFrame(x: number, y: number): Promise<Result<MoodboardItem>>
    /** Place an existing frame as a node on the canvas. */
    addFrameItem(frameId: string, x: number, y: number): Promise<Result<MoodboardItem>>
    /** Add an empty Preview node at (x, y). */
    addPreview(x: number, y: number): Promise<Result<MoodboardItem>>
    /** Add a resizable layer group container at (x, y). */
    addLayer(x: number, y: number): Promise<Result<MoodboardItem>>
    updateItem(id: string, patch: MoodboardItemPatch): Promise<Result<MoodboardItem>>
    deleteItem(id: string): Promise<Result<void>>
    /** Import media into the shared library AND place it on the board near (x, y). */
    importAndPlace(x: number, y: number): Promise<Result<MoodboardItem[]>>
    createConnector(
      fromItemId: string,
      toItemId: string,
      sourceHandle?: string | null,
      targetHandle?: string | null,
    ): Promise<Result<MoodboardConnector>>
    deleteConnector(id: string): Promise<Result<void>>
    /** Replace the entire board (used by canvas undo/redo). */
    replaceBoard(items: MoodboardItem[], connectors: MoodboardConnector[]): Promise<Result<void>>
  }
  dialog: {
    /** Native folder picker; returns the chosen absolute path or null if cancelled. */
    pickDirectory(): Promise<Result<string | null>>
  }
  shell: {
    /** Open an http(s) URL in the user's default browser. */
    openExternal(url: string): Promise<Result<void>>
  }
  events: {
    /** Subscribe to "asset library changed" pushes from main. Returns an unsubscribe fn. */
    onLibraryChanged(callback: () => void): () => void
  }
}

declare global {
  interface Window {
    storyline: StorylineApi
  }
}
