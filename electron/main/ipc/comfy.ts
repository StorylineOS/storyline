/** IPC handlers for the ComfyUI bridge. */
import { IpcChannels } from '@shared/ipc'
import type { Take, ComfyStatus, Shot } from '@shared/types'
import { handle } from './handler'
import { ping, linkShotWorkflow, pullLatestToShot } from '../comfy/client'

function str(v: unknown, label: string): string {
  if (typeof v !== 'string' || v.length === 0) throw new Error(`Invalid ${label}.`)
  return v
}

export function registerComfyHandlers(): void {
  handle<[], ComfyStatus>(IpcChannels.comfy.status, () => ping())
  handle<[string], Shot>(IpcChannels.comfy.linkShot, (shotId) =>
    linkShotWorkflow(str(shotId, 'shot id')),
  )
  handle<[string], Take>(IpcChannels.comfy.pullLatest, (shotId) =>
    pullLatestToShot(str(shotId, 'shot id')),
  )
}
