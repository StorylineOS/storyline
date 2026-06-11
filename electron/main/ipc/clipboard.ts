/** IPC handler for writing text to the system clipboard. */
import { clipboard } from 'electron'
import { IpcChannels } from '@shared/ipc'
import { handle } from './handler'

export function registerClipboardHandlers(): void {
  handle<[string], void>(IpcChannels.clipboard.writeText, (text) => {
    if (typeof text !== 'string') throw new Error('Invalid clipboard text.')
    clipboard.writeText(text)
  })
}
