/**
 * IPC handlers for project lifecycle. Each validates its payload (untrusted —
 * it comes from the renderer) before touching the filesystem.
 */
import { dialog } from 'electron'
import { join } from 'node:path'
import { IpcChannels, type CreateProjectInput } from '@shared/ipc'
import type { Project, RecentProject, ProjectMediaDirs } from '@shared/types'
import { handle } from './handler'
import { createProject, openProject, getCurrentProject, isProjectFolder } from '../project/store'
import { listRecents } from '../project/recents'
import { getOpenProjectFolder } from '../db'

function assertCreateInput(input: unknown): asserts input is CreateProjectInput {
  if (
    typeof input !== 'object' ||
    input === null ||
    typeof (input as CreateProjectInput).name !== 'string' ||
    typeof (input as CreateProjectInput).parentDir !== 'string'
  ) {
    throw new Error('Invalid create-project input.')
  }
  if ((input as CreateProjectInput).name.trim().length === 0) {
    throw new Error('Project name is required.')
  }
}

export function registerProjectHandlers(): void {
  handle<[CreateProjectInput], Project>(IpcChannels.project.create, (input) => {
    assertCreateInput(input)
    return createProject(input)
  })

  handle<[string], Project>(IpcChannels.project.open, (path) => {
    if (typeof path !== 'string' || path.length === 0) throw new Error('Invalid project path.')
    return openProject(path)
  })

  handle<[], Project | null>(IpcChannels.project.openDialog, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Open Storyline Project',
      properties: ['openDirectory'],
      buttonLabel: 'Open Project',
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const folder = result.filePaths[0]
    if (!isProjectFolder(folder)) {
      throw new Error('That folder is not a Storyline project.')
    }
    return openProject(folder)
  })

  handle<[], RecentProject[]>(IpcChannels.project.listRecent, () => listRecents())

  handle<[], Project | null>(IpcChannels.project.current, () => getCurrentProject())

  handle<[], ProjectMediaDirs>(IpcChannels.project.mediaDirs, () => {
    const folder = getOpenProjectFolder()
    if (!folder) throw new Error('No project is open.')
    return { inputDir: join(folder, 'assets'), outputDir: join(folder, 'takes') }
  })

  handle<[], string | null>(IpcChannels.dialog.pickDirectory, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose a location',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
}
