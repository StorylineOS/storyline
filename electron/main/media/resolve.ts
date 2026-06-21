/**
 * Resolve a renderer-supplied media reference (either a `inlinestudio-media://`
 * URL or a project-relative path like "takes/abc.png") to an absolute path inside
 * the open project folder — mirroring the protocol handler's `..`-traversal guards.
 * Returns null when no project is open or the path escapes the project root.
 */
import { join, normalize, sep } from 'node:path'
import { MEDIA_SCHEME } from '@shared/media'
import { getOpenProjectFolder } from '../db'

export function resolveMediaPath(src: string): string | null {
  const folder = getOpenProjectFolder()
  if (!folder || typeof src !== 'string' || src.length === 0) return null

  let relative: string
  if (src.startsWith(`${MEDIA_SCHEME}://`)) {
    relative = decodeURIComponent(new URL(src).pathname).replace(/^\/+/, '')
  } else {
    relative = src.replace(/\\/g, '/').replace(/^\/+/, '')
  }

  const target = normalize(join(folder, relative))
  const root = normalize(folder)
  if (target !== root && !target.startsWith(root + sep)) return null
  return target
}
