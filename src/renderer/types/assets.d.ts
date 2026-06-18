/** Asset imports resolve to their bundled URL (Vite). */
declare module '*.svg' {
  const src: string
  export default src
}
