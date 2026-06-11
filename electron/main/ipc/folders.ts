/** IPC handlers for asset-library folders. */
import { IpcChannels, type CreateFolderInput } from '@shared/ipc'
import type { AssetFolder } from '@shared/types'
import { handle } from './handler'
import { listFolders, createFolder, renameFolder, deleteFolder } from '../assets/folders'

function assertCreateInput(input: unknown): asserts input is CreateFolderInput {
  if (
    typeof input !== 'object' ||
    input === null ||
    typeof (input as CreateFolderInput).name !== 'string'
  ) {
    throw new Error('Invalid create-folder input.')
  }
  const parentId = (input as CreateFolderInput).parentId
  if (parentId !== null && typeof parentId !== 'string') {
    throw new Error('Invalid parent folder id.')
  }
}

export function registerFolderHandlers(): void {
  handle<[], AssetFolder[]>(IpcChannels.folders.list, () => listFolders())

  handle<[CreateFolderInput], AssetFolder>(IpcChannels.folders.create, (input) => {
    assertCreateInput(input)
    return createFolder(input)
  })

  handle<[string, string], AssetFolder>(IpcChannels.folders.rename, (id, name) => {
    if (typeof id !== 'string' || typeof name !== 'string') throw new Error('Invalid rename input.')
    return renameFolder(id, name)
  })

  handle<[string], void>(IpcChannels.folders.delete, (id) => {
    if (typeof id !== 'string') throw new Error('Invalid folder id.')
    deleteFolder(id)
  })
}
