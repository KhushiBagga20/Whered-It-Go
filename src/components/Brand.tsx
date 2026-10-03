import logo from '../assets/logo.webp'
import styles from './Brand.module.css'

/** The app mark: the app icon itself, built by `npm run icons` (docs/app-icon.md). */
export function LogoMark({ size = 36 }: { size?: number }) {
  return <img src={logo} width={size} height={size} alt="" draggable={false} style={{ borderRadius: size * 0.28 }} />
}

export function Wordmark({ tagline = true, size = 'md' }: { tagline?: boolean; size?: 'md' | 'lg' }) {
  return (
    <span className={`${styles.wordmark} ${styles[size]}`}>
      <span className={styles.name}>
        Where<span className={styles.apos}>’</span>d<span className={styles.it}>It</span>Go
      </span>
      {tagline && <span className={styles.tag}>Love &amp; Loss™</span>}
    </span>
  )
}
