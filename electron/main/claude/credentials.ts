/**
 * Encrypted storage for the user's Anthropic API key — the one secret Storyline holds.
 * It never goes in plaintext settings.json: it's encrypted with Electron `safeStorage`
 * (OS keychain-backed) and written to its own file under userData. The key lives only
 * in the main process and is never sent across the bridge to the renderer.
 *
 * On platforms without a secure keystore (some headless Linux), `safeStorage` can't
 * encrypt; we fall back to a clearly-marked plaintext file (0600) and let the UI warn.
 */
import { app, safeStorage } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'

/** Prefix that marks an unencrypted fallback file, so reads know how to decode it. */
const PLAINTEXT_MAGIC = Buffer.from('STORYLINE_PLAINTEXT_V1\n', 'utf-8')

function keyFile(): string {
  return join(app.getPath('userData'), 'claude-credentials.bin')
}

/** Whether the OS provides real encryption (false on some headless Linux). */
export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

export function isConfigured(): boolean {
  return existsSync(keyFile())
}

/** Persist the API key, encrypted when the OS supports it. */
export function setApiKey(key: string): void {
  const trimmed = key.trim()
  if (!trimmed) throw new Error('API key is empty.')
  if (safeStorage.isEncryptionAvailable()) {
    writeFileSync(keyFile(), safeStorage.encryptString(trimmed))
  } else {
    writeFileSync(keyFile(), Buffer.concat([PLAINTEXT_MAGIC, Buffer.from(trimmed, 'utf-8')]), {
      mode: 0o600,
    })
  }
}

/** Decrypt and return the stored key, or null if absent/unreadable. */
export function getApiKey(): string | null {
  try {
    if (!existsSync(keyFile())) return null
    const buf = readFileSync(keyFile())
    if (buf.subarray(0, PLAINTEXT_MAGIC.length).equals(PLAINTEXT_MAGIC)) {
      return buf.subarray(PLAINTEXT_MAGIC.length).toString('utf-8')
    }
    return safeStorage.decryptString(buf)
  } catch {
    return null
  }
}

export function clearApiKey(): void {
  rmSync(keyFile(), { force: true })
}
