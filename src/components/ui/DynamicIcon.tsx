import type { LucideProps } from 'lucide-react'
import { createElement } from 'react'
import { iconFor } from './icons'

/** Render a category/account icon by its stored name. */
export function DynamicIcon({ name, ...props }: LucideProps & { name: string }) {
  return createElement(iconFor(name), props)
}
