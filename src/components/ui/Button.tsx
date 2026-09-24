import { m, type HTMLMotionProps } from 'motion/react'
import { forwardRef, type ReactNode } from 'react'
import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'sky'

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
  icon?: ReactNode
  children?: ReactNode
}

/** Chunky, tactile buttons: a hard shadow that squashes when pressed. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, icon, children, className, type = 'button', ...rest },
  ref,
) {
  return (
    <m.button
      ref={ref}
      type={type}
      className={[styles.btn, styles[variant], styles[size], block && styles.block, className].filter(Boolean).join(' ')}
      whileTap={rest.disabled ? undefined : { scale: 0.96, y: 2 }}
      transition={{ type: 'spring', stiffness: 700, damping: 30 }}
      {...rest}
    >
      {icon}
      {children && <span>{children}</span>}
    </m.button>
  )
})
