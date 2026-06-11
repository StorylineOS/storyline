/**
 * A typed Result used across the IPC boundary so the renderer always gets a
 * predictable shape instead of thrown errors leaking process details.
 * See the "Async & errors" rule in CLAUDE.md.
 */
export type Ok<T> = { ok: true; value: T }
export type Err = { ok: false; error: string }
export type Result<T> = Ok<T> | Err

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value }
}

export function err(error: string): Err {
  return { ok: false, error }
}
