import logoUrl from '../assets/logo.svg'

/** The Inline Studio logo mark. Sized via `size` (px). */
export function Logo({ size = 28 }: { size?: number }): React.JSX.Element {
  return (
    <img
      src={logoUrl}
      alt="Inline Studio"
      width={size}
      height={size}
      className="rounded"
      style={{ width: size, height: size }}
    />
  )
}
