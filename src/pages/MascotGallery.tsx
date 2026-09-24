import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'wouter'
import { MASCOT_ASSETS, spriteFor } from '../mascot/assets'
import { EXPRESSIONS, POSES, REQUIRED_SPRITES } from '../mascot/catalog'
import { Mascot } from '../mascot/Mascot'
import type { MascotAnimation, MascotExpression, MascotPose } from '../mascot/types'
import { useData } from '../state/store'
import styles from './MascotGallery.module.css'

const ANIMS: MascotAnimation[] = ['hop', 'shake', 'nod', 'wiggle', 'spin', 'faint']

/**
 * Every pose × face she has. Tap one to make her move. In development it
 * also shows which drawings exist yet, so new art can be checked in place.
 */
export default function MascotGallery() {
  const name = useData((s) => s.profile.mascotName)
  const [played, setPlayed] = useState<{ key: string; n: number } | null>(null)
  const drawn = REQUIRED_SPRITES.filter((k) => k in MASCOT_ASSETS).length
  const dev = import.meta.env.DEV

  const cell = (pose: MascotPose, expression: MascotExpression) => {
    const key = `${pose}-${expression}`
    const sprite = spriteFor(pose, expression)
    const exact = sprite?.name === key
    const n = played?.key === key ? played.n : 0
    return (
      <button
        key={key}
        type="button"
        className={styles.cell}
        onClick={() => setPlayed({ key, n: n + 1 })}
        aria-label={`${pose}, ${expression}`}
      >
        <Mascot
          pose={pose}
          expression={expression}
          size={pose === 'peek' ? 64 : 96}
          animation={n ? ANIMS[n % ANIMS.length] : 'none'}
          animKey={n}
        />
        <span className={styles.tag}>{key}</span>
        {dev && (
          <span className={styles.status} data-state={exact ? 'drawn' : sprite ? 'fallback' : 'placeholder'}>
            {exact ? 'drawn' : sprite ? `using ${sprite.name}` : 'placeholder'}
            {sprite?.blink ? ' · blinks' : ''}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className={styles.page}>
      <Link href="/settings" className={styles.back}>
        <ArrowLeft size={18} /> Settings
      </Link>
      <header className={styles.head}>
        <p className="eyebrow">Meet her</p>
        <h1 className={styles.title}>All of tiny {name.toLowerCase()}</h1>
        <p className={styles.lede}>Tap any of her.</p>
        {dev && (
          <p className={styles.progress}>
            {drawn} of {REQUIRED_SPRITES.length} drawings in <code>src/assets/mascot/</code>
          </p>
        )}
      </header>

      {EXPRESSIONS.map((e) => (
        <section key={e.id} className={styles.row} aria-labelledby={`face-${e.id}`}>
          <div className={styles.rowHead}>
            <h2 id={`face-${e.id}`} className={styles.face}>
              {e.label}
            </h2>
            <p className={styles.when}>{e.when}</p>
          </div>
          <div className={styles.cells}>
            {POSES.filter((p) => p.id !== 'wave' || e.id === 'happy').map((p) => cell(p.id, e.id))}
          </div>
        </section>
      ))}
    </div>
  )
}
