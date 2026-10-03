import { LogOut, RotateCcw } from 'lucide-react'
import { Mascot } from '../mascot/Mascot'
import { boot, signOut } from '../state/store'
import { LogoMark, Wordmark } from './Brand'
import { Button } from './ui/Button'
import styles from './WaitingForJais.module.css'

/** Khushi signed in before Jais planted anything. Nothing to judge yet. */
export function WaitingForJais() {
  return (
    <main className={styles.page}>
      <div className={styles.brand}>
        <LogoMark size={52} />
        <Wordmark />
      </div>
      <Mascot pose="stand" expression="sleepy" size={120} />
      <h1 className={styles.title}>Nothing to investigate yet.</h1>
      <p className={styles.line}>
        Jais hasn’t set up his meadow. Once he signs in and says what the month started with, everything shows up here.
      </p>
      <div className={styles.actions}>
        <Button variant="primary" icon={<RotateCcw size={18} />} onClick={() => void boot()}>
          Check again
        </Button>
        <Button variant="sky" icon={<LogOut size={18} />} onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </main>
  )
}
