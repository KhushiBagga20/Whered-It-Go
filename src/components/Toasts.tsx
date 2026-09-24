import { AnimatePresence, m } from 'motion/react'
import { CircleAlert, Check, X } from 'lucide-react'
import { ui, useUi } from '../state/ui'
import styles from './Toasts.module.css'

/** Little paper slips that slide in above the hill. Errors keep their technical detail visible. */
export function Toasts() {
  const toasts = useUi((s) => s.toasts)
  return (
    <div className={styles.stack} role="region" aria-label="Notifications">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <m.div
            key={t.id}
            layout
            className={styles.toast}
            data-tone={t.tone}
            role={t.tone === 'error' ? 'alert' : 'status'}
            initial={{ opacity: 0, y: 24, scale: 0.9, rotate: -2 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, y: 12, scale: 0.95, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          >
            <span className={styles.icon} aria-hidden="true">
              {t.tone === 'error' ? <CircleAlert size={18} /> : <Check size={18} />}
            </span>
            <div className={styles.body}>
              <p className={styles.message}>{t.message}</p>
              {t.detail && <p className={styles.detail}>{t.detail}</p>}
            </div>
            {t.action && (
              <button
                type="button"
                className={styles.action}
                onClick={() => {
                  t.action!.run()
                  ui.dismissToast(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" className={styles.dismiss} onClick={() => ui.dismissToast(t.id)} aria-label="Dismiss">
              <X size={16} />
            </button>
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
