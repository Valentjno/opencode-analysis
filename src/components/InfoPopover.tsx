import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Info, X } from 'lucide-react'

interface Props {
  title: string
  children: ReactNode
  label?: string
}

/**
 * A dismissible explanation panel for a chart or table. Click/tap the trigger to
 * open, click outside, press Escape, or use the close button to dismiss.
 */
export function InfoPopover({ title, children, label }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  return (
    <span className="info" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="info-trigger"
        aria-label={label ?? `How to read ${title}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <Info size={13} aria-hidden="true" />
      </button>
      {open && (
        <span className="info-panel" id={panelId} role="dialog" aria-label={title}>
          <span className="info-panel-head">
            <strong>{title}</strong>
            <button
              type="button"
              className="info-close"
              aria-label="Close explanation"
              onClick={() => {
                setOpen(false)
                triggerRef.current?.focus()
              }}
            >
              <X size={13} aria-hidden="true" />
            </button>
          </span>
          <span className="info-panel-body">{children}</span>
        </span>
      )}
    </span>
  )
}
