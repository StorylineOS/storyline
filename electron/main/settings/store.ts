/**
 * App-global settings persisted as JSON in Electron userData. Currently just the
 * ComfyUI backend URL (defaults to the COMFYUI_URL env var, then localhost:8188).
 */
import { app } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import type { AppSettings } from '@shared/types'

const DEFAULT_COMFY_URL = process.env.COMFYUI_URL || 'http://127.0.0.1:8188'

function settingsFile(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function getSettings(): AppSettings {
  try {
    if (existsSync(settingsFile())) {
      const parsed = JSON.parse(readFileSync(settingsFile(), 'utf-8')) as Partial<AppSettings>
      if (typeof parsed.comfyUrl === 'string' && parsed.comfyUrl.length > 0) {
        return { comfyUrl: parsed.comfyUrl }
      }
    }
  } catch {
    // fall through to default
  }
  return { comfyUrl: DEFAULT_COMFY_URL }
}

export function setComfyUrl(url: string): AppSettings {
  const next: AppSettings = { comfyUrl: url.trim() || DEFAULT_COMFY_URL }
  writeFileSync(settingsFile(), JSON.stringify(next, null, 2), 'utf-8')
  return next
}
