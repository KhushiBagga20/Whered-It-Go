/** CSS colour for a category/account palette slot (0 = neutral, 1–9 validated order). */
export const catColor = (slot: number) => `var(--cat-${Math.max(0, Math.min(9, slot))})`
