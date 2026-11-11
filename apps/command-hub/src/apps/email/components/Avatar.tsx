import { hueOf, initials } from '../util'

export function Avatar({ from, size = 32 }: { from: string; size?: number }) {
  return (
    <span className="eml-avatar" style={{ '--h': hueOf(from), width: size, height: size, fontSize: size * 0.38 } as React.CSSProperties} aria-hidden>
      {initials(from)}
    </span>
  )
}
