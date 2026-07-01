/**
 * Import a project from an exported `.zip` (the counterpart to export/project.ts). We
 * extract into a sibling folder named after the zip and hand the result to `openProject`,
 * which tolerates the extra nesting exporters add (see resolveProjectFolder).
 */
import { dirname, join, basename } from 'node:path'
import extract from 'extract-zip'

/** Extract `zipPath` into a folder beside it (named after the zip) and return that folder. */
export async function extractProjectZip(zipPath: string): Promise<string> {
  const baseName = basename(zipPath).replace(/\.zip$/i, '') || 'project'
  const dest = join(dirname(zipPath), baseName)
  await extract(zipPath, { dir: dest })
  return dest
}
