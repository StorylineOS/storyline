/**
 * Serves the open project's local media to the sandboxed renderer over a custom
 * privileged scheme (inlinestudio-media://). The renderer can't read files directly,
 * so it requests `mediaUrl('assets/<id>.png')` and main resolves it against the
 * currently open project folder — with `..` traversal guards.
 *
 * Video/audio elements issue HTTP Range requests and need 206 Partial Content
 * responses to play; without that they render blank. So we read files directly and
 * honour the Range header (images just get a plain 200).
 */
import { protocol } from 'electron'
import { createReadStream, statSync } from 'node:fs'
import { join, normalize, sep, extname } from 'node:path'
import { Readable } from 'node:stream'
import { MEDIA_SCHEME } from '@shared/media'
import { getOpenProjectFolder } from '../db'

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.json': 'application/json',
}

function contentType(filePath: string): string {
  return MIME_BY_EXT[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

// Every media file is content-addressed by id (assets/<id>.ext, takes/<id>, thumbs/<id>.jpg)
// and never mutated in place, so the renderer can cache it forever. Without this Chromium
// re-fetches and re-decodes the full file each time an <img> remounts — which, with React
// Flow's onlyRenderVisibleElements, happens on every pan/zoom.
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable'

/** A web Response streaming `start..end` of a file (createReadStream end is inclusive). */
function fileResponse(
  filePath: string,
  status: number,
  start: number,
  end: number,
  headers: Record<string, string>,
): Response {
  const stream = createReadStream(filePath, { start, end })
  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, { status, headers })
}

/** Must run BEFORE app `ready`. Treats the scheme like a real, secure origin. */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      // corsEnabled lets the renderer fetch() peaks JSON for waveforms (media elements
      // don't need it, but fetch is cross-origin to this scheme and is blocked without it).
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true,
      },
    },
  ])
}

/** Must run AFTER app `ready`. Wires the actual file responder. */
export function registerMediaProtocol(): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    const projectFolder = getOpenProjectFolder()
    if (!projectFolder) return new Response('No project open', { status: 404 })

    // URL shape: inlinestudio-media://local/<relative path under project folder>
    const url = new URL(request.url)
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '')

    const target = normalize(join(projectFolder, relative))
    const root = normalize(projectFolder)
    if (target !== root && !target.startsWith(root + sep)) {
      return new Response('Forbidden', { status: 403 })
    }

    let size: number
    try {
      size = statSync(target).size
    } catch {
      return new Response('Not found', { status: 404 })
    }

    const type = contentType(target)
    const range = request.headers.get('range')
    const match = range ? /bytes=(\d*)-(\d*)/.exec(range) : null
    if (match) {
      let start = match[1] ? parseInt(match[1], 10) : 0
      let end = match[2] ? parseInt(match[2], 10) : size - 1
      if (Number.isNaN(start) || start < 0) start = 0
      if (Number.isNaN(end) || end >= size) end = size - 1
      if (start > end) return new Response('Range Not Satisfiable', { status: 416 })
      return fileResponse(target, 206, start, end, {
        'Content-Type': type,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(end - start + 1),
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': IMMUTABLE_CACHE,
      })
    }

    return fileResponse(target, 200, 0, size - 1, {
      'Content-Type': type,
      'Accept-Ranges': 'bytes',
      'Content-Length': String(size),
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': IMMUTABLE_CACHE,
    })
  })
}
