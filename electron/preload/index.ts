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
  },
  folders: {
    list: () => ipcRenderer.invoke(IpcChannels.folders.list),
    create: (input: CreateFolderInput) => ipcRenderer.invoke(IpcChannels.folders.create, input),
    rename: (id: string, name: string) => ipcRenderer.invoke(IpcChannels.folders.rename, id, name),
    delete: (id: string) => ipcRenderer.invoke(IpcChannels.folders.delete, id),
  },
  shots: {
    list: () => ipcRenderer.invoke(IpcChannels.shots.list),
    importAsShots: () => ipcRenderer.invoke(IpcChannels.shots.importAsShots),
    addFromAsset: (assetId: string) => ipcRenderer.invoke(IpcChannels.shots.addFromAsset, assetId),
    rename: (id: string, name: string) => ipcRenderer.invoke(IpcChannels.shots.rename, id, name),
    reorder: (orderedIds: string[]) => ipcRenderer.invoke(IpcChannels.shots.reorder, orderedIds),
    delete: (id: string) => ipcRenderer.invoke(IpcChannels.shots.delete, id),
    setHero: (id: string, takeId: string | null) =>
      ipcRenderer.invoke(IpcChannels.shots.setHero, id, takeId),
    listTakes: (shotId: string) => ipcRenderer.invoke(IpcChannels.shots.listTakes, shotId),
    heroTakes: () => ipcRenderer.invoke(IpcChannels.shots.heroTakes),
  },
  comfy: {
    status: () => ipcRenderer.invoke(IpcChannels.comfy.status),
    linkShot: (shotId: string) => ipcRenderer.invoke(IpcChannels.comfy.linkShot, shotId),
    pullLatest: (shotId: string) => ipcRenderer.invoke(IpcChannels.comfy.pullLatest, shotId),
  },
  settings: {
    get: () => ipcRenderer.invoke(IpcChannels.settings.get),
    setComfyUrl: (url: string) => ipcRenderer.invoke(IpcChannels.settings.setComfyUrl, url),
  },
  export: {
    exportShots: () => ipcRenderer.invoke(IpcChannels.export.exportShots),
  },
  moodboard: {
    list: () => ipcRenderer.invoke(IpcChannels.moodboard.list),
    addAsset: (assetId: string, x: number, y: number) =>
      ipcRenderer.invoke(IpcChannels.moodboard.addAsset, assetId, x, y),
    addText: (x: number, y: number) => ipcRenderer.invoke(IpcChannels.moodboard.addText, x, y),
    updateItem: (id: string, patch: MoodboardItemPatch) =>
      ipcRenderer.invoke(IpcChannels.moodboard.updateItem, id, patch),
    deleteItem: (id: string) => ipcRenderer.invoke(IpcChannels.moodboard.deleteItem, id),
    importAndPlace: (x: number, y: number) =>
      ipcRenderer.invoke(IpcChannels.moodboard.importAndPlace, x, y),
    createConnector: (fromItemId: string, toItemId: string) =>
      ipcRenderer.invoke(IpcChannels.moodboard.createConnector, fromItemId, toItemId),
    deleteConnector: (id: string) => ipcRenderer.invoke(IpcChannels.moodboard.deleteConnector, id),
  },
  dialog: {
    pickDirectory: () => ipcRenderer.invoke(IpcChannels.dialog.pickDirectory),
  },
}

contextBridge.exposeInMainWorld('storyline', api)
