/**
 * Local project media (assets, takes, thumbs) is served to the renderer through a
 * custom privileged scheme instead of file:// — the sandboxed renderer can't read
 * the filesystem directly. Main resolves these URLs against the open project folder.
 *
 *   storyline-media://local/assets/<id>.png
 */
export const MEDIA_SCHEME = 'storyline-media'

/** Build a media URL from a project-relative path (e.g. "assets/abc.png"). */
export function mediaUrl(relativePath: string): string {
  const clean = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
  const encoded = clean.split('/').map(encodeURIComponent).join('/')
  return `${MEDIA_SCHEME}://local/${encoded}`
}
