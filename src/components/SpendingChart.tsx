import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import type { Category } from '../data/types'
import type { CategorySlice } from '../lib/finance'
import { formatINR } from '../lib/money'
import { MascotSpot } from '../mascot/MascotSpot'
import { CategoryBadge } from './ui/CategoryBadge'
import { catColor } from './ui/palette'
import styles from './SpendingChart.module.css'

const SIZE = 240
const R = 88
const W = 34
const C = 2 * Math.PI * R
const GAP = 2.2 // surface gap between slices, in px of arc
const MAX_SLICES = 8

/** Palette-slot order: the order the colours were validated to sit next to each other in. */
const slotRank = (slot: number) => (slot === 0 ? 10 : slot)

interface Arc {
  key: string
  slice: CategorySlice
  start: number
  len: number
}

/** Up to 7 categories + "Everything else" so the donut never needs a 9th colour. */
function foldSlices(slices: CategorySlice[]): CategorySlice[] {
  if (slices.length <= MAX_SLICES) return slices
  const keep = slices.slice(0, MAX_SLICES - 1)
  const rest = slices.slice(MAX_SLICES - 1)
  const total = rest.reduce((a, s) => a + s.total, 0)
  const other: Category = {
    id: '__rest',
    key: null,
    name: 'Everything else',
    kind: 'expense',
    icon: 'shapes',
    color: 0,
    sortOrder: 999,
    archived: false,
    createdAt: '',
    updatedAt: '',
  }
  return [
    ...keep,
    {
      category: other,
      total,
      count: rest.reduce((a, s) => a + s.count, 0),
      share: rest.reduce((a, s) => a + s.share, 0),
      merchants: rest.map((s) => ({ label: s.category.name, total: s.total, count: s.count })),
      transactions: rest.flatMap((s) => s.transactions),
    },
  ]
}

/**
 * WHERE'D IT GO? — spending by category. Slices sit in fixed colour order
 * (so neighbours stay distinguishable and slices grow in place when data
 * changes); the legend underneath is sorted by amount and doubles as the
 * accessible table. Tap either to drill into a category.
 */
export function SpendingChart({ slices, total }: { slices: CategorySlice[]; total: number }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const reduced = useReducedMotion()
  const [, navigate] = useLocation()

  const folded = useMemo(() => foldSlices(slices), [slices])
  const arcs = useMemo<Arc[]>(() => {
    const ordered = [...folded].sort(
      (a, b) => slotRank(a.category.color) - slotRank(b.category.color) || a.category.sortOrder - b.category.sortOrder,
    )
    const out: Arc[] = []
    for (const slice of ordered) {
      const start = out.length ? out[out.length - 1].start + out[out.length - 1].len : 0
      out.push({ key: slice.category.id, slice, start, len: slice.share * C })
    }
    return out
  }, [folded])

  const selectedSlice = folded.find((s) => s.category.id === selected) ?? null
  const focus = folded.find((s) => s.category.id === (hovered ?? selected)) ?? null
  const toggle = (id: string) => setSelected((cur) => (cur === id ? null : id))

  return (
    <div className={styles.wrap}>
      <div className={styles.chartBox}>
        <div className={styles.mascot}>
          <MascotSpot pose="sit" expression={selected ? 'suspicious' : 'judging'} size={54} look={-1} bubble="left" />
        </div>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className={styles.svg}
          role="img"
          aria-label={`Spending by category: ${folded.map((s) => `${s.category.name} ${formatINR(s.total)}`).join(', ')}`}
        >
          {/* hand-drawn outline ring */}
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R + W / 2 + 5} className={styles.outline} />
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} className={styles.track} strokeWidth={W} />
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            {arcs.map((a, i) => {
              const active = selected === a.key || hovered === a.key
              const dim = (selected || hovered) && !active
              const len = Math.max(0.001, a.len - (arcs.length > 1 ? GAP : 0))
              return (
                <m.circle
                  key={a.key}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  fill="none"
                  stroke={catColor(a.slice.category.color)}
                  className={styles.slice}
                  initial={reduced ? false : { strokeDasharray: `0 ${C}`, strokeDashoffset: -a.start }}
                  animate={{
                    strokeDasharray: `${len} ${C - len}`,
                    strokeDashoffset: -a.start,
                    strokeWidth: active ? W + 12 : W,
                    opacity: dim ? 0.35 : 1,
                  }}
                  transition={{ type: 'spring', stiffness: 160, damping: 24, delay: reduced ? 0 : i * 0.04 }}
                  onClick={() => toggle(a.key)}
                  onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(a.key)}
                  onPointerLeave={() => setHovered(null)}
                />
              )
            })}
          </g>
        </svg>
        <div className={styles.center} aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={focus?.category.id ?? 'total'}
              className={styles.centerInner}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.16 }}
            >
              {focus ? (
                <>
                  <span className={styles.centerLabel}>{focus.category.name}</span>
                  <span className={`${styles.centerValue} num`}>{formatINR(focus.total)}</span>
                  <span className={styles.centerShare}>{Math.round(focus.share * 100)}% of it</span>
                </>
              ) : (
                <>
                  <span className={styles.centerLabel}>gone</span>
                  <span className={`${styles.centerValue} num`}>{formatINR(total)}</span>
                  <span className={styles.centerShare}>tap a slice</span>
                </>
              )}
            </m.div>
          </AnimatePresence>
        </div>
      </div>

      <ul className={styles.legend} aria-label="Spending by category">
        {folded.map((s) => {
          const open = selected === s.category.id
          const isRest = s.category.id === '__rest'
          return (
            <li key={s.category.id} className={styles.legendItem} data-open={open || undefined}>
              <button
                type="button"
                className={styles.legendRow}
                aria-expanded={open}
                onClick={() => toggle(s.category.id)}
                onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(s.category.id)}
                onPointerLeave={() => setHovered(null)}
              >
                <CategoryBadge category={s.category} size={34} />
                <span className={styles.legendName}>{s.category.name}</span>
                <span className={styles.bar} aria-hidden="true">
                  <m.span
                    className={styles.barFill}
                    style={{ background: catColor(s.category.color) }}
                    initial={false}
                    animate={{ scaleX: s.share }}
                    transition={{ type: 'spring', stiffness: 140, damping: 22 }}
                  />
                </span>
                <span className={`${styles.legendAmount} num`}>{formatINR(s.total)}</span>
                <ChevronDown size={18} className={styles.chev} aria-hidden="true" />
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <m.div
                    className={styles.drill}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                  >
                    <ul className={styles.merchants}>
                      {s.merchants.slice(0, 6).map((mm, i) => (
                        <m.li
                          key={mm.label}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.05 + i * 0.04 }}
                        >
                          <span className={styles.merchant}>
                            {mm.label}
                            {mm.count > 1 && <span className={styles.times}> ×{mm.count}</span>}
                          </span>
                          <span className={`${styles.merchantAmt} num`}>{formatINR(mm.total)}</span>
                        </m.li>
                      ))}
                    </ul>
                    {!isRest && (
                      <button
                        type="button"
                        className={styles.seeAll}
                        onClick={() => navigate(`/history?category=${encodeURIComponent(s.category.id)}`)}
                      >
                        See all {s.count} {s.count === 1 ? 'transaction' : 'transactions'} <ArrowRight size={16} />
                      </button>
                    )}
                  </m.div>
                )}
              </AnimatePresence>
            </li>
          )
        })}
      </ul>
      {selectedSlice && <span className="sr-only">{selectedSlice.category.name} expanded</span>}
    </div>
  )
}
