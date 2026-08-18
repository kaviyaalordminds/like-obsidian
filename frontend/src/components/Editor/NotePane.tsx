import { useEffect, useRef } from 'react'
import type { EditorView } from '@uiw/react-codemirror'
import { Pencil, Columns2, Eye, Loader2, Check, AlertCircle } from 'lucide-react'
import { NoteEditor } from './NoteEditor'
import { MarkdownPreview } from './MarkdownPreview'
import { EditorToolbar } from './EditorToolbar'
import { useNoteStore } from '@/store/noteStore'
import { useVaultStore } from '@/store/vaultStore'
import { useUIStore, type EditorMode } from '@/store/uiStore'
import type { SaveStatus } from '@/types'

interface Props {
  path: string
  onOpenNote: (path: string) => void
  onCreateNote: (path: string) => void
}

function SaveStatusBadge({ status }: { status: SaveStatus }) {
  if (status === 'saving') return <span className="flex items-center gap-1 text-xs text-[var(--color-text-faint)]"><Loader2 size={12} className="animate-spin" /> Saving…</span>
  if (status === 'saved') return <span className="flex items-center gap-1 text-xs text-[var(--color-text-faint)]"><Check size={12} /> Saved</span>
  if (status === 'error') return <span className="flex items-center gap-1 text-xs text-[var(--color-danger)]"><AlertCircle size={12} /> Error saving</span>
  return null
}

const modeIcons: Record<EditorMode, React.ComponentType<{ size?: number }>> = {
  edit: Pencil,
  split: Columns2,
  preview: Eye,
}

export function NotePane({ path, onOpenNote, onCreateNote }: Props) {
  const vault = useVaultStore((s) => s.currentVault)
  const entry = useNoteStore((s) => s.entries[path])
  const loadNote = useNoteStore((s) => s.loadNote)
  const updateContent = useNoteStore((s) => s.updateContent)
  const saveNow = useNoteStore((s) => s.saveNow)
  const mode = useUIStore((s) => s.editorMode)
  const setEditorMode = useUIStore((s) => s.setEditorMode)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (vault) loadNote(vault.id, path)
  }, [vault, path, loadNote])

  if (!vault) return null
  if (!entry || entry.loading) {
    return <div className="flex-1 flex items-center justify-center text-[var(--color-text-faint)]">Loading…</div>
  }

  const tags = entry.note.tags

  return (
    <div className="flex flex-col h-full min-w-0">
      <div className="flex items-center justify-between px-3 py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-semibold truncate">{entry.note.title}</h2>
          {tags.length > 0 && (
            <div className="hidden sm:flex items-center gap-1 flex-wrap">
              {tags.slice(0, 5).map((t) => (
                <span key={t} className="tag-pill">#{t}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <SaveStatusBadge status={entry.status} />
          <div className="flex items-center rounded-md border" style={{ borderColor: 'var(--color-border)' }}>
            {(['edit', 'split', 'preview'] as EditorMode[]).map((m) => {
              const Icon = modeIcons[m]
              return (
                <button
                  key={m}
                  onClick={() => setEditorMode(m)}
                  title={m[0].toUpperCase() + m.slice(1)}
                  className="p-1.5 first:rounded-l-md last:rounded-r-md"
                  style={{
                    background: mode === m ? 'var(--color-accent-soft)' : 'transparent',
                    color: mode === m ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  }}
                >
                  <Icon size={14} />
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {mode !== 'preview' && <EditorToolbar getView={() => viewRef.current} />}

      <div className="flex-1 min-h-0 flex">
        {mode !== 'preview' && (
          <div className={mode === 'split' ? 'w-1/2 border-r h-full' : 'w-full h-full'} style={{ borderColor: 'var(--color-border)' }}>
            <NoteEditor
              value={entry.content}
              onChange={(value) => updateContent(vault.id, path, value)}
              onSaveShortcut={() => saveNow(vault.id, path)}
              onEditorReady={(view) => {
                viewRef.current = view
              }}
            />
          </div>
        )}
        {mode !== 'edit' && (
          <div className={mode === 'split' ? 'w-1/2 h-full overflow-auto' : 'w-full h-full overflow-auto'}>
            <MarkdownPreview content={entry.content} onOpenNote={onOpenNote} onCreateNote={onCreateNote} />
          </div>
        )}
      </div>
    </div>
  )
}
