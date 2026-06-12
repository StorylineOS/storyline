/** IPC handlers for the ComfyUI bridge. */
import { IpcChannels } from '@shared/ipc'
import type { Take, ComfyStatus, Frame, ComfyRun, ComfyOutput } from '@shared/types'
import { handle } from './handler'
import {
  ping,
  linkFrameWorkflow,
  uploadFrameInputs,
  pullLatestToFrame,
  latestRun,
  captureOutput,
} from '../comfy/client'

function str(v: unknown, label: string): string {
  if (typeof v !== 'string' || v.length === 0) throw new Error(`Invalid ${label}.`)
  return v
}

function asOutput(v: unknown): ComfyOutput {
  if (typeof v !== 'object' || v === null || typeof (v as ComfyOutput).filename !== 'string') {
    throw new Error('Invalid output.')
  }
  return v as ComfyOutput
}

export function registerComfyHandlers(): void {
  handle<[], ComfyStatus>(IpcChannels.comfy.status, () => ping())
  handle<[string], Frame>(IpcChannels.comfy.linkFrame, (frameId) =>
    linkFrameWorkflow(str(frameId, 'frame id')),
  )
  handle<[string], string[]>(IpcChannels.comfy.uploadInputs, (frameId) =>
    uploadFrameInputs(str(frameId, 'frame id')),
  )
  handle<[string], Take>(IpcChannels.comfy.pullLatest, (frameId) =>
    pullLatestToFrame(str(frameId, 'frame id')),
  )
  handle<[], ComfyRun | null>(IpcChannels.comfy.latestRun, () => latestRun())
  handle<[string, ComfyOutput], Take>(IpcChannels.comfy.captureOutput, (frameId, output) =>
    captureOutput(str(frameId, 'frame id'), asOutput(output)),
  )
}
