/** IPC handlers for the asset library. */
import { IpcChannels } from '@shared/ipc'
import type { Asset } from '@shared/types'
import { handle } from './handler'
import { importViaDialog, listAssets } from '../assets/store'

function asFolderId(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new Error('Invalid folder id.')
  return value
}

export function registerAssetHandlers(): void {
  handle<[string | null], Asset[]>(IpcChannels.assets.importDialog, (folderId) =>
    importViaDialog(asFolderId(folderId)),
  )
  handle<[], Asset[]>(IpcChannels.assets.list, () => listAssets())
}
