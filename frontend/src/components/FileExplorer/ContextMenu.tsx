import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export interface MenuItem {
  label: string
  onClick: () => void
  danger?: boolean
  separator?: boolean
}

interface Props {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', escHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', escHandler)
    }
  }, [onClose])

  const clampedX = Math.min(x, window.innerWidth - 200)
  const clampedY = Math.min(y, window.innerHeight - items.length * 32 - 16)

  return createPortal(
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] rounded-lg border py-1 shadow-lg"
      style={{
        left: clampedX,
        top: clampedY,
        background: 'var(--color-bg-elevated)',
        borderColor: 'var(--color-border)',
        boxShadow: 'var(--shadow-glow)',
      }}
    >
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} className="my-1 border-t" style={{ borderColor: 'var(--color-border)' }} />
        ) : (
          <button
            key={i}
            onClick={() => {
              item.onClick()
              onClose()
            }}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--color-bg-inset)]"
            style={{ color: item.danger ? 'var(--color-danger)' : 'var(--color-text)' }}
          >
            {item.label}
          </button>
        ),
      )}
    </div>,
    document.body,
  )
}
