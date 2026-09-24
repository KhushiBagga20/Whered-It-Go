import { Mascot } from '../mascot/Mascot'
import { LogoMark, Wordmark } from './Brand'
import styles from './Splash.module.css'

/** While the app wakes up: the mark, the name, and her, waiting. */
export function Splash() {
  return (
    <div className={styles.splash} role="status" aria-label="Loading Where’dItGo">
      <LogoMark size={72} />
      <Wordmark size="lg" />
      <div className={styles.mascot}>
        <Mascot pose="sit" expression="sleepy" size={64} />
      </div>
    </div>
  )
}
