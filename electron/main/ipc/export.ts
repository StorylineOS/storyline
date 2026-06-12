/** IPC handlers for exporting. */
import { IpcChannels } from '@shared/ipc'
import type { ExportResult } from '@shared/types'
import { handle } from './handler'
import { exportFrames } from '../export/folder'

export function registerExportHandlers(): void {
  handle<[], ExportResult | null>(IpcChannels.export.exportFrames, () => exportFrames())
}
