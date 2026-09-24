import { AnimatePresence, m, useDragControls, useReducedMotion, type PanInfo } from 'motion/react'
import { X } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useMedia } from '../../hooks/useMedia'
import { pushSheet } from '../../lib/sheetHistory'
import styles from './Sheet.module.css'

export interface SheetProps {
  open: boolean
  onClose: () => void
  /** Accessible name; also shown as the heading unless `hideTitle`. */
  title: string
  hideTitle?: boolean
  children: ReactNode
  /** Rendered outside the scroll area (e.g. a sticky submit button). */
  footer?: ReactNode
  /** Decorations that hang off the sheet edge (the peeking mascot). */
  adornment?: ReactNode
  tone?: 'paper' | 'spent' | 'received'
  width?: number
  /** Element to focus first (defaults to the sheet itself). */
  initialFocus?: React.RefObject<HTMLElement | null>
}

let openCount = 0

function lockScroll(lock: boolean) {
  openCount += lock ? 1 : -1
  document.documentElement.classList.toggle('sheet-open', openCount > 0)
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Bottom sheet on phones (drag down to dismiss), centred dialog on larger
 * screens. Traps focus, closes on Escape and on the Android back button,
 * and gives focus back to whatever opened it.
 */
export function Sheet({
  open,
  onClose,
  title,
  hideTitle,
  children,
  footer,
  adornment,
  tone = 'paper',
  width = 520,
  initialFocus,
}: SheetProps) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const dialog = useMedia('(min-width: 720px)')
  const reduced = useReducedMotion()
  const drag = useDragControls()
  const closeRef = useRef(onClose)
  useLayoutEffect(() => {
    closeRef.current = onClose
  })

  // history (back button) + scroll lock + focus restore
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const release = pushSheet(() => closeRef.current())
    lockScroll(true)
    const t = window.setTimeout(() => {
      const target = initialFocus?.current ?? panel.current
      target?.focus({ preventScroll: true })
    }, 60)
    return () => {
      window.clearTimeout(t)
      release()
      lockScroll(false)
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true })
    }
  }, [open, initialFocus])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !panel.current) return
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 650) onClose()
  }

  const variants = dialog
    ? {
        hidden: { opacity: 0, scale: 0.92, y: 24 },
        shown: { opacity: 1, scale: 1, y: 0 },
      }
    : {
        hidden: { y: '100%' },
        shown: { y: 0 },
      }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={styles.layer} onKeyDown={onKeyDown}>
          <m.div
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />
          <m.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={`${styles.panel} ${dialog ? styles.dialog : styles.sheet}`}
            data-tone={tone}
            style={{ maxWidth: dialog ? width : undefined }}
            variants={variants}
            initial="hidden"
            animate="shown"
            exit="hidden"
            transition={reduced ? { duration: 0.01 } : { type: 'spring', stiffness: 380, damping: 36, mass: 0.9 }}
            drag={dialog ? false : 'y'}
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.7 }}
            onDragEnd={onDragEnd}
          >
            {adornment}
            {!dialog && (
              <div className={styles.grip} onPointerDown={(e) => drag.start(e)} aria-hidden="true">
                <span />
              </div>
            )}
            <header className={styles.head} onPointerDown={(e) => !dialog && drag.start(e)}>
              <h2 id={titleId} className={hideTitle ? 'sr-only' : styles.title}>
                {title}
              </h2>
              <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
                <X size={20} strokeWidth={2.4} />
              </button>
            </header>
            <div className={styles.scroll}>{children}</div>
            {footer && <div className={styles.footer}>{footer}</div>}
          </m.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
