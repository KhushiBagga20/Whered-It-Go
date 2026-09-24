import { useState } from 'react'

/**
 * A number that goes up every time `open` flips to true. Use it as a `key`
 * on a sheet's contents so each opening starts with fresh form state —
 * no effects re-seeding state, and closing still animates out.
 */
export function useOpenKey(open: boolean): number {
  const [prev, setPrev] = useState(open)
  const [key, setKey] = useState(0)
  if (open !== prev) {
    setPrev(open)
    if (open) setKey((k) => k + 1)
  }
  return key
}
