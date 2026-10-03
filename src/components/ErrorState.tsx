import { RotateCcw } from 'lucide-react'
import { Mascot } from '../mascot/Mascot'
import { Button } from './ui/Button'
import styles from './ErrorState.module.css'

/**
 * The joke first, then the real problem, then a clear way out.
 * The technical detail is always shown, never hidden behind the joke.
 */
export function ErrorState({
  message = 'Something broke.',
  detail,
  onRetry,
  retryLabel = 'Retry',
}: {
  message?: string
  detail?: string
  onRetry?: () => void
  retryLabel?: string
}) {
  return (
    <div className={styles.wrap} role="alert">
      <Mascot pose="stand" expression="shocked" size={96} animation="shake" animKey={detail} />
      <h2 className={styles.title}>{message}</h2>
      <p className={styles.sub}>The money is probably fine. The app is not.</p>
      {detail && <pre className={styles.detail}>{detail}</pre>}
      {onRetry && (
        <Button variant="primary" size="lg" onClick={onRetry} icon={<RotateCcw size={18} strokeWidth={2.6} />}>
          {retryLabel}
        </Button>
      )}
    </div>
  )
}
