/**
 * Serves the open project's local media to the sandboxed renderer over a custom
 * privileged scheme (storyline-media://). The renderer can't read files directly,
 * so it requests `mediaUrl('assets/<id>.png')` and main resolves it against the
 * currently open project folder — with `..` traversal guards.
 */
import { protocol, net } from 'electron'
import { join, normalize, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { MEDIA_SCHEME } from '@shared/media'
import { getOpenProjectFolder } from '../db'

/** Must run BEFORE app `ready`. Treats the scheme like a real, secure origin. */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
    },
  ])
}

/** Must run AFTER app `ready`. Wires the actual file responder. */
export function registerMediaProtocol(): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    const projectFolder = getOpenProjectFolder()
    if (!projectFolder) return new Response('No project open', { status: 404 })

    // URL shape: storyline-media://local/<relative path under project folder>
    const url = new URL(request.url)
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '')

    const target = normalize(join(projectFolder, relative))
    const root = normalize(projectFolder)
    if (target !== root && !target.startsWith(root + sep)) {
      return new Response('Forbidden', { status: 403 })
    }

    return net.fetch(pathToFileURL(target).toString())
  })
}
