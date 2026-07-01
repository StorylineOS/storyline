/**
 * Import a project from an exported `.zip` (the counterpart to export/project.ts). We
 * extract into a fresh sibling folder named after the zip and hand the result to
 * `openProject`, which tolerates the extra nesting exporters add (see resolveProjectFolder).
 */
import { dirname, join, basename } from 'node:path'
import { existsSync } from 'node:fs'
import extract from 'extract-zip'

/**
 * A non-colliding folder path: `base`, else `base (2)`, `base (3)`, … Extracting into a
 * fresh folder avoids clobbering a previous extraction whose `project.db`/`-shm` may still
 * be memory-mapped/locked (on Windows that surfaces as an "UNKNOWN" open error).
 */
function uniqueDir(base: string): string {
  if (!existsSync(base)) return base
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base} (${i})`
    if (!existsSync(candidate)) return candidate
  }
  return `${base} (${Date.now()})`
}

/** Extract `zipPath` into a fresh folder beside it (named after the zip) and return it. */
export async function extractProjectZip(zipPath: string): Promise<string> {
  const baseName = basename(zipPath).replace(/\.zip$/i, '') || 'project'
  const dest = uniqueDir(join(dirname(zipPath), baseName))
  await extract(zipPath, { dir: dest })
  return dest
}
