import { useNoteStore } from '@/store/noteStore'

interface Props {
  path: string
}

export function OutlinePanel({ path }: Props) {
  const entry = useNoteStore((s) => s.entries[path])
  const headings = entry?.note?.headings ?? []

  if (headings.length === 0) {
    return <div className="p-3 text-xs text-[var(--color-text-faint)]">No headings in this note.</div>
  }

  return (
    <div className="p-3 space-y-0.5 overflow-auto">
      {headings.map((h, i) => (
        <div
          key={i}
          className="text-sm py-1 truncate cursor-default text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          style={{ paddingLeft: (h.level - 1) * 12 }}
        >
          {h.text}
        </div>
      ))}
    </div>
  )
}
