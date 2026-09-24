import { animate, useReducedMotion } from 'motion/react'
import { useLayoutEffect, useRef } from 'react'
import { formatINR, type FormatOptions } from '../../lib/money'

/**
 * A rupee amount that counts to its new value instead of snapping.
 * Writes straight to the text node (React renders the span empty), so
 * counting never re-renders anything.
 */
export function MoneyDisplay({
  value,
  className,
  format,
  duration = 0.9,
}: {
  value: number
  className?: string
  format?: FormatOptions
  duration?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const shown = useRef<number | null>(null)
  const reduced = useReducedMotion()
  const fkey = JSON.stringify(format ?? {})

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fmt = JSON.parse(fkey) as FormatOptions
    const from = shown.current
    if (from === null || reduced || from === value) {
      shown.current = value
      el.textContent = formatINR(value, fmt)
      return
    }
    const controls = animate(from, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        shown.current = v
        el.textContent = formatINR(Math.round(v), fmt)
      },
      onComplete: () => {
        shown.current = value
        el.textContent = formatINR(value, fmt)
      },
    })
    return () => controls.stop()
  }, [value, reduced, duration, fkey])

  return <span ref={ref} className={className} />
}
