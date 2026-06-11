/** The Storyline mark: "SL" in a white-bordered square (no fill). Sized via `size` (px). */
export function Logo({ size = 28 }: { size?: number }): React.JSX.Element {
  return (
    <div
      className="flex items-center justify-center border border-white font-bold leading-none text-white"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-label="Storyline"
      title="Storyline"
    >
      SL
    </div>
  )
}
