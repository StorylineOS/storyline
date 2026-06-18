/**
 * The ONLY bridge between renderer and main. Exposes a typed, minimal surface on
 * `window.storyline` via contextBridge — no Node, no ipcRenderer, no raw channels
 * leak into the renderer (see CLAUDE.md security baseline + layering rule).
 */
import { contextBridge, ipcRenderer } from 'electron'
import {
  IpcChannels,
  type StorylineApi,
  type CreateProjectInput,
  type CreateFolderInput,
  type MoodboardItemPatch,
} from '@shared/ipc'
import type {
  ComfyOutput,
  MoodboardItem,
  MoodboardConnector,
  ClaudeSendInput,
  ClaudeDeltaEvent,
  ClaudeDoneEvent,
  ClaudeErrorEvent,
} from '@shared/types'
import type { ClaudeProposal } from '@shared/claudeActions'
import type { IpcRendererEvent } from 'electron'

const api: StorylineApi = {
  project: {
    create: (input: CreateProjectInput) => ipcRenderer.invoke(IpcChannels.project.create, input),
    open: (path: string) => ipcRenderer.invoke(IpcChannels.project.open, path),
    openDialog: () => ipcRenderer.invoke(IpcChannels.project.openDialog),
    listRecent: () => ipcRenderer.invoke(IpcChannels.project.listRecent),
    current: () => ipcRenderer.invoke(IpcChannels.project.current),
    mediaDirs: () => ipcRenderer.invoke(IpcChannels.project.mediaDirs),
  },
  clipboard: {
    writeText: (text: string) => ipcRenderer.invoke(IpcChannels.clipboard.writeText, text),
  },
  assets: {
    importDialog: (folderId: string | null) =>
      ipcRenderer.invoke(IpcChannels.assets.importDialog, folderId),
    list: () => ipcRenderer.invoke(IpcChannels.assets.list),
    delete: (assetId: string) => ipcRenderer.invoke(IpcChannels.assets.delete, assetId),
  },
  folders: {
    list: () => ipcRenderer.invoke(IpcChannels.folders.list),
    create: (input: CreateFolderInput) => ipcRenderer.invoke(IpcChannels.folders.create, input),
    rename: (id: string, name: string) => ipcRenderer.invoke(IpcChannels.folders.rename, id, name),
    delete: (id: string) => ipcRenderer.invoke(IpcChannels.folders.delete, id),
  },
  frames: {
    list: () => ipcRenderer.invoke(IpcChannels.frames.list),
    importAsFrames: () => ipcRenderer.invoke(IpcChannels.frames.importAsFrames),
    addFromAsset: (assetId: string) => ipcRenderer.invoke(IpcChannels.frames.addFromAsset, assetId),
    rename: (id: string, name: string) => ipcRenderer.invoke(IpcChannels.frames.rename, id, name),
    reorder: (orderedIds: string[]) => ipcRenderer.invoke(IpcChannels.frames.reorder, orderedIds),
    delete: (id: string) => ipcRenderer.invoke(IpcChannels.frames.delete, id),
    clone: (id: string) => ipcRenderer.invoke(IpcChannels.frames.clone, id),
    unlink: (id: string) => ipcRenderer.invoke(IpcChannels.frames.unlink, id),
    setHero: (id: string, takeId: string | null) =>
      ipcRenderer.invoke(IpcChannels.frames.setHero, id, takeId),
    listTakes: (frameId: string) => ipcRenderer.invoke(IpcChannels.frames.listTakes, frameId),
    heroTakes: () => ipcRenderer.invoke(IpcChannels.frames.heroTakes),
    listInputs: () => ipcRenderer.invoke(IpcChannels.frames.listInputs),
    addInput: (frameId: string, assetId: string) =>
      ipcRenderer.invoke(IpcChannels.frames.addInput, frameId, assetId),
    addSourceInput: (frameId: string, sourceFrameId: string) =>
      ipcRenderer.invoke(IpcChannels.frames.addSourceInput, frameId, sourceFrameId),
    removeInput: (frameId: string, assetId: string) =>
      ipcRenderer.invoke(IpcChannels.frames.removeInput, frameId, assetId),
    reorderInputs: (frameId: string, orderedAssetIds: string[]) =>
      ipcRenderer.invoke(IpcChannels.frames.reorderInputs, frameId, orderedAssetIds),
    listAllTakes: () => ipcRenderer.invoke(IpcChannels.frames.listAllTakes),
    deleteTake: (takeId: string) => ipcRenderer.invoke(IpcChannels.frames.deleteTake, takeId),
  },
  comfy: {
    status: () => ipcRenderer.invoke(IpcChannels.comfy.status),
    linkFrame: (frameId: string) => ipcRenderer.invoke(IpcChannels.comfy.linkFrame, frameId),
    uploadInputs: (frameId: string) => ipcRenderer.invoke(IpcChannels.comfy.uploadInputs, frameId),
    pullWorkflow: (frameId: string) => ipcRenderer.invoke(IpcChannels.comfy.pullWorkflow, frameId),
    saveLiveWorkflow: (frameId: string, workflow: unknown) =>
      ipcRenderer.invoke(IpcChannels.comfy.saveLiveWorkflow, frameId, workflow),
    pushWorkflow: (frameId: string) => ipcRenderer.invoke(IpcChannels.comfy.pushWorkflow, frameId),
    pullLatest: (frameId: string) => ipcRenderer.invoke(IpcChannels.comfy.pullLatest, frameId),
    latestRun: () => ipcRenderer.invoke(IpcChannels.comfy.latestRun),
    captureOutput: (frameId: string, output: ComfyOutput) =>
      ipcRenderer.invoke(IpcChannels.comfy.captureOutput, frameId, output),
  },
  settings: {
    get: () => ipcRenderer.invoke(IpcChannels.settings.get),
    setComfyUrl: (url: string) => ipcRenderer.invoke(IpcChannels.settings.setComfyUrl, url),
  },
  claude: {
    status: () => ipcRenderer.invoke(IpcChannels.claude.status),
    setApiKey: (key: string) => ipcRenderer.invoke(IpcChannels.claude.setApiKey, key),
    clearApiKey: () => ipcRenderer.invoke(IpcChannels.claude.clearApiKey),
    send: (input: ClaudeSendInput) => ipcRenderer.invoke(IpcChannels.claude.send, input),
    cancel: () => ipcRenderer.invoke(IpcChannels.claude.cancel),
  },
  export: {
    exportFrames: () => ipcRenderer.invoke(IpcChannels.export.exportFrames),
  },
  moodboard: {
    list: () => ipcRenderer.invoke(IpcChannels.moodboard.list),
    addAsset: (assetId: string, x: number, y: number) =>
      ipcRenderer.invoke(IpcChannels.moodboard.addAsset, assetId, x, y),
    addText: (x: number, y: number) => ipcRenderer.invoke(IpcChannels.moodboard.addText, x, y),
    addFrameFromAsset: (assetId: string, x: number, y: number) =>
      ipcRenderer.invoke(IpcChannels.moodboard.addFrameFromAsset, assetId, x, y),
    addEmptyFrame: (x: number, y: number) =>
      ipcRenderer.invoke(IpcChannels.moodboard.addEmptyFrame, x, y),
    addFrameItem: (frameId: string, x: number, y: number) =>
      ipcRenderer.invoke(IpcChannels.moodboard.addFrameItem, frameId, x, y),
    addPreview: (x: number, y: number) =>
      ipcRenderer.invoke(IpcChannels.moodboard.addPreview, x, y),
    addLayer: (x: number, y: number) => ipcRenderer.invoke(IpcChannels.moodboard.addLayer, x, y),
    updateItem: (id: string, patch: MoodboardItemPatch) =>
      ipcRenderer.invoke(IpcChannels.moodboard.updateItem, id, patch),
    deleteItem: (id: string) => ipcRenderer.invoke(IpcChannels.moodboard.deleteItem, id),
    importAndPlace: (x: number, y: number) =>
      ipcRenderer.invoke(IpcChannels.moodboard.importAndPlace, x, y),
    createConnector: (
      fromItemId: string,
      toItemId: string,
      sourceHandle: string | null = null,
      targetHandle: string | null = null,
    ) =>
      ipcRenderer.invoke(
        IpcChannels.moodboard.createConnector,
        fromItemId,
        toItemId,
        sourceHandle,
        targetHandle,
      ),
    deleteConnector: (id: string) => ipcRenderer.invoke(IpcChannels.moodboard.deleteConnector, id),
    replaceBoard: (items: MoodboardItem[], connectors: MoodboardConnector[]) =>
      ipcRenderer.invoke(IpcChannels.moodboard.replaceBoard, items, connectors),
  },
  dialog: {
    pickDirectory: () => ipcRenderer.invoke(IpcChannels.dialog.pickDirectory),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke(IpcChannels.shell.openExternal, url),
  },
  events: {
    onLibraryChanged: (callback: () => void) => {
      const listener = (): void => callback()
      ipcRenderer.on(IpcChannels.events.libraryChanged, listener)
      return () => ipcRenderer.removeListener(IpcChannels.events.libraryChanged, listener)
    },
    onClaudeDelta: (callback: (e: ClaudeDeltaEvent) => void) =>
      subscribe(IpcChannels.events.claudeDelta, callback),
    onClaudeProposal: (callback: (p: ClaudeProposal) => void) =>
      subscribe(IpcChannels.events.claudeProposal, callback),
    onClaudeDone: (callback: (e: ClaudeDoneEvent) => void) =>
      subscribe(IpcChannels.events.claudeDone, callback),
    onClaudeError: (callback: (e: ClaudeErrorEvent) => void) =>
      subscribe(IpcChannels.events.claudeError, callback),
  },
}

/** Subscribe to a payload-carrying main→renderer event; returns an unsubscribe fn. */
function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('storyline', api)
