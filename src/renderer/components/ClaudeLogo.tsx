/** Claude's sunburst mark, rendered as a radial burst. Tints with `currentColor`. */
const SPOKES = Array.from({ length: 12 }, (_, i) => {
  const a = (i * Math.PI) / 6
  return {
    x1: 12 + 3.5 * Math.cos(a),
    y1: 12 + 3.5 * Math.sin(a),
    x2: 12 + 10 * Math.cos(a),
    y2: 12 + 10 * Math.sin(a),
  }
})

export function ClaudeLogo({
  size = 18,
  className,
}: {
  size?: number
  className?: string
}): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      {SPOKES.map((s, i) => (
        <line
          key={i}
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}
