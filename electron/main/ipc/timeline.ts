/** IPC handlers for director-node timelines. Payloads come from the renderer — validate. */
import { IpcChannels } from '@shared/ipc'
import type { DirectorTimeline, TrimResolved } from '@shared/types'
import { handle } from './handler'
import { resolveTimeline, resolveTrim } from '../timeline/resolve'
import { buildPreview, exportTimeline } from '../timeline/compose'
import { getMoodboardItem, updateItem } from '../moodboard/store'

function str(v: unknown, label: string): string {
  if (typeof v !== 'string' || v.length === 0) throw new Error(`Invalid ${label}.`)
  return v
}

/** Clamp an untrusted volume to 0..1. */
function vol(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 1
  return Math.min(1, Math.max(0, n))
}

export function registerTimelineHandlers(): void {
  handle<[string], DirectorTimeline>(IpcChannels.timeline.resolve, async (ownerItemId) => {
    const { timeline } = await resolveTimeline(str(ownerItemId, 'owner item id'))
    return timeline
  })

  handle<[string], TrimResolved | null>(IpcChannels.timeline.resolveTrim, (itemId) =>
    resolveTrim(str(itemId, 'item id')),
  )

  handle<[string, number, number], void>(
    IpcChannels.timeline.setVolumes,
    (ownerItemId, l1Volume, l2Volume) => {
      const id = str(ownerItemId, 'owner item id')
      const item = getMoodboardItem(id)
      updateItem(id, { data: { ...item.data, l1Volume: vol(l1Volume), l2Volume: vol(l2Volume) } })
    },
  )

  handle<[string], string | null>(IpcChannels.timeline.buildPreview, (ownerItemId) =>
    buildPreview(str(ownerItemId, 'owner item id')),
  )

  handle<[string], string | null>(IpcChannels.timeline.export, (ownerItemId) =>
    exportTimeline(str(ownerItemId, 'owner item id')),
  )
}
