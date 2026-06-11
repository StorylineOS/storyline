/**
 * Small helper so every IPC handler returns a typed `Result<T>` and never leaks
 * a raw thrown error across the bridge (see CLAUDE.md "Async & errors").
 */
import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { ok, err, type Result } from '@shared/result'

export function handle<TArgs extends unknown[], TResult>(
  channel: string,
  fn: (...args: TArgs) => TResult | Promise<TResult>,
): void {
  ipcMain.handle(
    channel,
    async (_event: IpcMainInvokeEvent, ...args: unknown[]): Promise<Result<TResult>> => {
      try {
        const value = await fn(...(args as TArgs))
        return ok(value)
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        console.error(`[ipc:${channel}]`, message)
        return err(message)
      }
    },
  )
}
