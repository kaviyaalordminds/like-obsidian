import { useState } from 'react'
import { AlertTriangle, Check, Columns2, GitMerge, X } from 'lucide-react'

interface Props {
  localContent: string
  externalContent: string
  onKeepCurrent: () => void
  onUseExternal: () => void
  onMerge: () => void
}

// External-Change-Detected dialog (Part 56): shown whenever a save finds
// the file on disk no longer matches what was last read — another tab,
// Obsidian itself, or a sync client changed it. Never resolved silently;
// Cancel only dismisses the dialog for now, it doesn't discard the
// conflict, so a "Resolve" banner stays up until one of the other three
// actions is actually taken.
export function ConflictDialog({ localContent, externalContent, onKeepCurrent, onUseExternal, onMerge }: Props) {
  const [open, setOpen] = useState(true)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 px-3 py-2 rounded-md text-xs text-white shadow-lg"
        style={{ background: 'var(--color-danger)' }}
      >
        <AlertTriangle size={13} /> This note changed elsewhere — resolve
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <div
        className="relative w-full max-w-3xl max-h-[80vh] rounded-xl border flex flex-col overflow-hidden"
        style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-glow)' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h3 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-danger)' }}>
            <AlertTriangle size={14} /> External change detected
          </h3>
          <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-[var(--color-bg-inset)]" title="Cancel — decide later">
            <X size={14} />
          </button>
        </div>

        <p className="px-4 pt-3 text-xs text-[var(--color-text-faint)]">
          This note was changed outside the app since it was last read here — by another tab, Obsidian itself, or a
          sync client. Nothing has been overwritten. Choose which version to keep.
        </p>

        <div className="flex-1 grid grid-cols-2 divide-x overflow-auto mt-3" style={{ borderColor: 'var(--color-border)' }}>
          <div className="p-4">
            <div className="flex items-center gap-1.5 text-sm font-semibold mb-2">
              <Columns2 size={13} /> Current (unsaved, in this editor)
            </div>
            <pre className="text-xs whitespace-pre-wrap font-mono text-[var(--color-text-muted)]">{localContent}</pre>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-1.5 text-sm font-semibold mb-2">
              <Columns2 size={13} /> External (on disk)
            </div>
            <pre className="text-xs whitespace-pre-wrap font-mono text-[var(--color-text-muted)]">{externalContent}</pre>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={() => setOpen(false)}
            className="px-3 py-1.5 rounded-md text-xs border"
            style={{ borderColor: 'var(--color-border)' }}
          >
            Cancel
          </button>
          <button onClick={onMerge} className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs border" style={{ borderColor: 'var(--color-border)' }}>
            <GitMerge size={12} /> Merge
          </button>
          <button onClick={onUseExternal} className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs border" style={{ borderColor: 'var(--color-border)' }}>
            Use external
          </button>
          <button
            onClick={onKeepCurrent}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-white"
            style={{ background: 'var(--color-accent)' }}
          >
            <Check size={12} /> Keep current
          </button>
        </div>
      </div>
    </div>
  )
}
