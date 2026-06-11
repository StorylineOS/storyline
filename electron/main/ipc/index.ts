/** Registers all IPC handlers. New feature areas add their register* call here. */
import { registerProjectHandlers } from './project'
import { registerAssetHandlers } from './assets'
import { registerFolderHandlers } from './folders'
import { registerMoodboardHandlers } from './moodboard'
import { registerShotHandlers } from './shots'
import { registerComfyHandlers } from './comfy'
import { registerSettingsHandlers } from './settings'

export function registerIpcHandlers(): void {
  registerProjectHandlers()
  registerAssetHandlers()
  registerFolderHandlers()
  registerMoodboardHandlers()
  registerShotHandlers()
  registerComfyHandlers()
  registerSettingsHandlers()
}
