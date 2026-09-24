import { memo } from 'react'

/** Little hand-drawn plants. Each is its own tiny SVG so it can sway as a composited layer. */

const INK = '#1a0c30'

export const Daisy = memo(function Daisy({ height = 80, petal = '#ffc6de' }: { height?: number; petal?: string }) {
  return (
    <svg width={(height * 40) / 90} height={height} viewBox="0 0 40 90" aria-hidden="true">
      <path d="M20 24 C18 44 23 64 20 90" stroke="#178d33" strokeWidth={3.2} fill="none" strokeLinecap="round" />
      <path d="M20.5 58 C13 52 8 55 6 60 C12 63 17 62 20.5 58Z" fill="#27b93b" stroke={INK} strokeWidth={1.4} />
      <g transform="translate(20 18)" stroke={INK} strokeWidth={1.4}>
        {[0, 51, 103, 154, 206, 257, 309].map((a) => (
          <ellipse key={a} cx={0} cy={-9.5} rx={5} ry={8.6} fill={petal} transform={`rotate(${a})`} />
        ))}
        <circle r={5.6} fill="#ffd23f" />
        <circle r={1.3} cx={-1.6} cy={-1.4} fill="#ff7a1a" stroke="none" />
        <circle r={1.1} cx={1.8} cy={1.2} fill="#ff7a1a" stroke="none" />
      </g>
    </svg>
  )
})

export const Sunflower = memo(function Sunflower({ height = 110 }: { height?: number }) {
  return (
    <svg width={(height * 48) / 110} height={height} viewBox="0 0 48 110" aria-hidden="true">
      <path d="M24 28 C21 52 27 80 24 110" stroke="#178d33" strokeWidth={3.6} fill="none" strokeLinecap="round" />
      <path d="M24.5 70 C32 62 38 65 41 70 C34 75 28 74 24.5 70Z" fill="#27b93b" stroke={INK} strokeWidth={1.4} />
      <path d="M23.5 86 C16 79 10 82 8 87 C14 91 20 90 23.5 86Z" fill="#27b93b" stroke={INK} strokeWidth={1.4} />
      <g transform="translate(24 23)" stroke={INK} strokeWidth={1.3}>
        {Array.from({ length: 13 }, (_, i) => (i * 360) / 13).map((a) => (
          <path key={a} d="M0 -8 C4 -12 3.5 -18 0 -21.5 C-3.5 -18 -4 -12 0 -8Z" fill="#ffd23f" transform={`rotate(${a})`} />
        ))}
        <circle r={9} fill="#7a3b12" />
        <circle r={5.5} fill="#5a2a0a" stroke="none" />
        {[
          [-3, -2],
          [2, -4],
          [4, 2],
          [-1, 4],
          [-5, 2],
        ].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r={0.9} fill="#ffb13b" stroke="none" />
        ))}
      </g>
    </svg>
  )
})

export const Tuft = memo(function Tuft({ width = 44, tone = 0 }: { width?: number; tone?: 0 | 1 }) {
  const fill = tone ? '#5fe03a' : '#8bff5c'
  return (
    <svg width={width} height={width * 0.7} viewBox="0 0 44 31" aria-hidden="true">
      <g fill={fill} stroke={INK} strokeWidth={1.5} strokeLinejoin="round">
        <path d="M4 31 C6 22 5 14 1 6 C9 12 11 21 11 31Z" />
        <path d="M11 31 C13 19 15 9 13 0 C19 9 20 20 18 31Z" />
        <path d="M18 31 C21 21 25 13 31 8 C28 16 26 24 26 31Z" />
        <path d="M25 31 C27 23 30 16 37 12 C35 19 33 25 33 31Z" />
        <path d="M32 31 C35 25 39 21 44 20 C41 24 40 28 40 31Z" />
      </g>
    </svg>
  )
})

export const TinyBloom = memo(function TinyBloom({ color = '#ff9b4f' }: { color?: string }) {
  return (
    <svg width={16} height={26} viewBox="0 0 16 26" aria-hidden="true">
      <path d="M8 10 C7 16 9 20 8 26" stroke="#178d33" strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <g transform="translate(8 7)" stroke={INK} strokeWidth={1.1}>
        {[0, 72, 144, 216, 288].map((a) => (
          <circle key={a} cx={0} cy={-3.6} r={3} fill={color} transform={`rotate(${a})`} />
        ))}
        <circle r={2} fill="#fff6ea" />
      </g>
    </svg>
  )
})

export function Petal({ color = '#ffc6de' }: { color?: string }) {
  return (
    <svg width={12} height={10} viewBox="0 0 12 10" aria-hidden="true">
      <path d="M1 6 C2 1 8 -1 11 3 C9 8 4 10 1 6Z" fill={color} />
    </svg>
  )
}

export function Sparkle({ size = 10, color = '#fff6ea' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden="true">
      <path d="M5 0 C5.6 3.6 6.4 4.4 10 5 C6.4 5.6 5.6 6.4 5 10 C4.4 6.4 3.6 5.6 0 5 C3.6 4.4 4.4 3.6 5 0Z" fill={color} />
    </svg>
  )
}
