import styles from './Brand.module.css'

/** The app mark: a ₹ sun setting behind a neon hill, one pink flower. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={{ borderRadius: size * 0.28, overflow: 'hidden' }}>
      <rect width="64" height="64" rx="18" fill="#2d1260" />
      <circle cx="32" cy="30" r="17" fill="#ffd23f" />
      <path
        d="M26.5 21.5h12M26.5 26.5h12M30.5 21.5c4.2 0 6.4 2.2 6.4 5s-2.2 5-6.4 5h-3.2l8.4 8.6"
        fill="none"
        stroke="#1a0c30"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M0 46 C14 38 26 40 36 44 C46 48 54 42 64 40 V64 H0Z" fill="#8bff5c" />
      <path d="M0 46 C14 38 26 40 36 44 C46 48 54 42 64 40" fill="none" stroke="#1a0c30" strokeWidth="2" />
      <g transform="translate(47 43)">
        {[0, 72, 144, 216, 288].map((a) => (
          <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 3.4} cy={Math.sin((a * Math.PI) / 180) * 3.4} r="3" fill="#ffc6de" stroke="#1a0c30" strokeWidth="1" />
        ))}
        <circle r="1.9" fill="#ff7a1a" />
      </g>
    </svg>
  )
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
