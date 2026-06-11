/** Registers all IPC handlers. New feature areas add their register* call here. */
import { registerProjectHandlers } from './project'
import { registerAssetHandlers } from './assets'
import { registerFolderHandlers } from './folders'
import { registerMoodboardHandlers } from './moodboard'
import { registerShotHandlers } from './shots'

export function registerIpcHandlers(): void {
  registerProjectHandlers()
  registerAssetHandlers()
  registerFolderHandlers()
  registerMoodboardHandlers()
  registerShotHandlers()
}
