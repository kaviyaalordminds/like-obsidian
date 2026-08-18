import { useEffect, useMemo, useState } from 'react'
import { Command } from 'cmdk'
import { FileText, Plus } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useVaultStore } from '@/store/vaultStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { api } from '@/api/client'
import { flattenFiles } from '@/lib/tree'

export function QuickSwitcher() {
  const open = useUIStore((s) => s.quickSwitcherOpen)
  const setOpen = useUIStore((s) => s.setQuickSwitcherOpen)
  const vault = useVaultStore((s) => s.currentVault)
  const tree = useVaultStore((s) => s.tree)
  const refreshTree = useVaultStore((s) => s.refreshTree)
  const openNote = useWorkspaceStore((s) => s.openNote)
  const recent = useWorkspaceStore((s) => s.recent)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const files = useMemo(() => flattenFiles(tree).filter((f) => f.is_markdown), [tree])

  const results = useMemo(() => {
    if (!query.trim()) {
      return recent.map((p) => files.find((f) => f.path === p)).filter((f): f is NonNullable<typeof f> => !!f)
    }
    const q = query.toLowerCase()
    return files.filter((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)).slice(0, 40)
  }, [files, query, recent])

  const exactExists = files.some((f) => f.path.replace(/\.md$/i, '').toLowerCase() === query.trim().toLowerCase())

  const select = (path: string) => {
    openNote(path)
    setOpen(false)
  }

  const createAndOpen = async () => {
    if (!vault || !query.trim()) return
    const note = await api.createNote(vault.id, `${query.trim()}.md`, '')
    await refreshTree()
    select(note.path)
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Quick switcher"
      shouldFilter={false}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
    >
      <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <div
        className="relative w-full max-w-lg rounded-xl border overflow-hidden"
        style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-glow)' }}
      >
        <Command.Input
          value={query}
          onValueChange={setQuery}
          autoFocus
          placeholder="Jump to note…"
          className="w-full px-4 py-3 bg-transparent outline-none border-b text-sm"
          style={{ borderColor: 'var(--color-border)' }}
        />
        <Command.List className="max-h-80 overflow-auto p-2">
          {results.length === 0 && !query && (
            <div className="px-3 py-6 text-center text-sm text-[var(--color-text-faint)]">Start typing to search notes.</div>
          )}
          {results.map((f) => (
            <Command.Item
              key={f.path}
              value={f.path}
              onSelect={() => select(f.path)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer data-[selected=true]:bg-[var(--color-accent-soft)] data-[selected=true]:text-[var(--color-accent)]"
            >
              <FileText size={14} />
              <span className="truncate">{f.name.replace(/\.md$/i, '')}</span>
              <span className="ml-auto text-xs text-[var(--color-text-faint)] truncate">{f.path}</span>
            </Command.Item>
          ))}
          {query.trim() && !exactExists && (
            <Command.Item
              value={`create-${query}`}
              onSelect={createAndOpen}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer text-[var(--color-accent)] data-[selected=true]:bg-[var(--color-accent-soft)]"
            >
              <Plus size={14} />
              Create "{query.trim()}"
            </Command.Item>
          )}
        </Command.List>
      </div>
    </Command.Dialog>
  )
}
