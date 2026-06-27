/** IPC for app-level metadata (running version, etc.). */
import { app } from 'electron'
import { IpcChannels } from '@shared/ipc'
import { handle } from './handler'

export function registerAppHandlers(): void {
  handle<[], string>(IpcChannels.app.version, () => app.getVersion())
}
