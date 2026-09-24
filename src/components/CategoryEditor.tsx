import { Archive, CircleAlert, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useOpenKey } from '../hooks/useOpenKey'
import type { Category, TxType } from '../data/types'
import { newId, nowIso } from '../lib/id'
import { validateName } from '../lib/validation'
import { removeCategory, saveCategory, useData } from '../state/store'
import { ui } from '../state/ui'
import styles from './CategoryEditor.module.css'
import { Button } from './ui/Button'
import { CategoryBadge } from './ui/CategoryBadge'
import { catColor } from './ui/palette'
import form from './ui/Form.module.css'
import { DynamicIcon } from './ui/DynamicIcon'
import { PICKABLE_ICONS } from './ui/icons'
import { Sheet } from './ui/Sheet'

const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]

interface CategoryEditorProps {
  open: boolean
  onClose: () => void
  kind: TxType
  category?: Category
  onSaved?: (c: Category) => void
}

/** Create or edit a category: name, icon, colour. Kept deliberately small. */
export function CategoryEditor(props: CategoryEditorProps) {
  return <CategoryEditorSheet key={useOpenKey(props.open)} {...props} />
}

function CategoryEditorSheet({ open, onClose, kind, category, onSaved }: CategoryEditorProps) {
  const categories = useData((s) => s.categories)
  const used = useData((s) => (category ? s.transactions.some((t) => t.categoryId === category.id) : false))
  const [name, setName] = useState(category?.name ?? '')
  const [icon, setIcon] = useState(category?.icon ?? 'sparkles')
  const [color, setColor] = useState(category?.color ?? 6)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const others = categories.filter((c) => c.kind === kind && c.id !== category?.id && !c.archived).map((c) => c.name)
    const problem = validateName(name, others, 'category')
    if (problem) {
      setError(problem)
      nameRef.current?.focus()
      return
    }
    setSaving(true)
    const ts = nowIso()
    const next: Category = category
      ? { ...category, name: name.trim(), icon, color }
      : {
          id: newId(),
          key: null,
          name: name.trim(),
          kind,
          icon,
          color,
          sortOrder: Math.max(0, ...categories.filter((c) => c.kind === kind).map((c) => c.sortOrder)) + 1,
          archived: false,
          createdAt: ts,
          updatedAt: ts,
        }
    try {
      await saveCategory(next)
      onSaved?.(next)
      onClose()
    } catch {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!category) return
    const result = await removeCategory(category.id)
    ui.toast(result === 'deleted' ? `${category.name} deleted.` : `${category.name} archived — past spending keeps it.`)
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={category ? `Edit ${category.name}` : kind === 'expense' ? 'New spending category' : 'New income source'}
      initialFocus={nameRef}
      width={480}
      footer={
        <div className={styles.footer}>
          {category && (
            <Button variant="ghost" onClick={remove} icon={used ? <Archive size={18} /> : <Trash2 size={18} />}>
              {used ? 'Archive' : 'Delete'}
            </Button>
          )}
          <Button type="submit" form="category-form" variant="primary" size="lg" block disabled={saving}>
            {saving ? 'Saving…' : category ? 'Save' : 'Create'}
          </Button>
        </div>
      }
    >
      <form id="category-form" onSubmit={save} noValidate>
        <div className={styles.preview}>
          <CategoryBadge icon={icon} color={color} size={64} />
          <span className={styles.previewName}>{name.trim() || 'F1? Gym? Dates?'}</span>
        </div>
        <div className={form.field}>
          <label className={form.label} htmlFor="category-name">
            Name
          </label>
          <input
            ref={nameRef}
            id="category-name"
            className={form.input}
            value={name}
            maxLength={24}
            placeholder={kind === 'expense' ? 'Coffee' : 'Freelance'}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'category-error' : undefined}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
          />
          {error && (
            <p className={form.error} id="category-error">
              <CircleAlert size={16} /> {error}
            </p>
          )}
        </div>
        <fieldset className={`${form.field} ${form.fieldset}`}>
          <legend className={form.label}>Colour</legend>
          <div className={styles.swatches} role="radiogroup" aria-label="Colour">
            {SLOTS.map((slot) => (
              <button
                key={slot}
                type="button"
                role="radio"
                aria-checked={color === slot}
                aria-label={`Colour ${slot === 0 ? 'neutral' : slot}`}
                className={styles.swatch}
                style={{ background: catColor(slot) }}
                onClick={() => setColor(slot)}
              />
            ))}
          </div>
        </fieldset>
        <fieldset className={`${form.field} ${form.fieldset}`}>
          <legend className={form.label}>Icon</legend>
          <div className={styles.icons} role="radiogroup" aria-label="Icon">
            {PICKABLE_ICONS.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={icon === key}
                  aria-label={key.replace(/-/g, ' ')}
                  className={styles.icon}
                  onClick={() => setIcon(key)}
                >
                  <DynamicIcon name={key} size={20} strokeWidth={2.3} />
                </button>
              ))}
          </div>
        </fieldset>
      </form>
    </Sheet>
  )
}
