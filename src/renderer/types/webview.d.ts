/**
 * Minimal typing for Electron's <webview> element used in the Generate tab.
 * We intentionally do NOT import from 'electron' here (renderer layering rule);
 * only the few members we actually use are declared.
 */
import type { DetailedHTMLProps, HTMLAttributes } from 'react'

export interface ComfyWebview extends HTMLElement {
  src: string
  getURL(): string
  reload(): void
  /** Hard reload: re-fetches everything, bypassing the HTTP cache. */
  reloadIgnoringCache(): void
  /** Whether the guest page has finished loading (false right after a reload). */
  isLoading(): boolean
  /** Runs code inside the embedded page (cross-origin allowed in Electron). */
  executeJavaScript(code: string): Promise<unknown>
}

type WebviewProps = DetailedHTMLProps<HTMLAttributes<ComfyWebview>, ComfyWebview> & {
  src?: string
  partition?: string
  allowpopups?: boolean
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      webview: WebviewProps
    }
  }
}
