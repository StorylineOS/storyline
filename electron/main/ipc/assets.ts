/** IPC handlers for the asset library. */
import { IpcChannels } from '@shared/ipc'
import type { Asset } from '@shared/types'
import { handle } from './handler'
import { importViaDialog, importPaths, listAssets, deleteAsset } from '../assets/store'

function asFolderId(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new Error('Invalid folder id.')
  return value
}

export function registerAssetHandlers(): void {
  handle<[string | null], Asset[]>(IpcChannels.assets.importDialog, (folderId) =>
    importViaDialog(asFolderId(folderId)),
  )
  handle<[string[], string | null], Asset[]>(IpcChannels.assets.importPaths, (paths, folderId) => {
    if (!Array.isArray(paths)) throw new Error('Invalid paths.')
    return importPaths(
      paths.filter((p): p is string => typeof p === 'string'),
      asFolderId(folderId),
    )
  })
  handle<[], Asset[]>(IpcChannels.assets.list, () => listAssets())
  handle<[string], void>(IpcChannels.assets.delete, (assetId) => {
    if (typeof assetId !== 'string' || assetId.length === 0) throw new Error('Invalid asset id.')
    deleteAsset(assetId)
  })
}
