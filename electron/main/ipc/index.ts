/** Registers all IPC handlers. New feature areas add their register* call here. */
import { registerProjectHandlers } from './project'
import { registerAssetHandlers } from './assets'
import { registerFolderHandlers } from './folders'
import { registerMoodboardHandlers } from './moodboard'
import { registerFrameHandlers } from './frames'
import { registerComfyHandlers } from './comfy'
import { registerSettingsHandlers } from './settings'
import { registerClaudeHandlers } from './claude'
import { registerExportHandlers } from './export'
import { registerClipboardHandlers } from './clipboard'
import { registerMediaHandlers } from './media'
import { registerShellHandlers } from './shell'

export function registerIpcHandlers(): void {
  registerProjectHandlers()
  registerAssetHandlers()
  registerFolderHandlers()
  registerMoodboardHandlers()
  registerFrameHandlers()
  registerComfyHandlers()
  registerSettingsHandlers()
  registerClaudeHandlers()
  registerExportHandlers()
  registerClipboardHandlers()
  registerMediaHandlers()
  registerShellHandlers()
}
