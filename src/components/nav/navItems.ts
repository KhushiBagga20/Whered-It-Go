import { CalendarDays, House, ReceiptText, Wallet, type LucideIcon } from 'lucide-react'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
}

/** The four places. Order drives page-slide direction. */
export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Home', icon: House },
  { path: '/calendar', label: 'Calendar', icon: CalendarDays },
  { path: '/history', label: 'History', icon: ReceiptText },
  { path: '/money', label: 'Money', icon: Wallet },
]

export function navIndex(path: string): number {
  if (path.startsWith('/settings')) return NAV_ITEMS.length
  const i = NAV_ITEMS.findIndex((n) => n.path === path)
  return i === -1 ? 0 : i
}
