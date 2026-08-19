import { useEffect, useMemo, useState } from 'react'
import { FilePlus, FileEdit, FileX, Move, History } from 'lucide-react'
import { api } from '@/api/client'
import { useVaultStore } from '@/store/vaultStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useUIStore } from '@/store/uiStore'
import type { ActivityEntry } from '@/types'

const ACTION_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  create: FilePlus,
  save: FileEdit,
  delete: FileX,
  rename: Move,
  move: Move,
}

const ACTION_LABEL: Record<string, string> = {
  create: 'Created',
  save: 'Updated',
  delete: 'Deleted',
  rename: 'Renamed',
  move: 'Moved',
}

type GroupBy = 'day' | 'week' | 'month'

function groupKey(date: Date, by: GroupBy): string {
  if (by === 'day') return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
  if (by === 'month') return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const start = new Date(date)
  start.setDate(date.getDate() - date.getDay())
  return `Week of ${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

export function ActivityPage() {
  const vault = useVaultStore((s) => s.currentVault)
  const openNote = useWorkspaceStore((s) => s.openNote)
  const setMainView = useUIStore((s) => s.setMainView)
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [groupBy, setGroupBy] = useState<GroupBy>('day')

  useEffect(() => {
    if (!vault) return
    api.listActivity(vault.id).then(setEntries)
  }, [vault])

  const groups = useMemo(() => {
    const map = new Map<string, ActivityEntry[]>()
    for (const entry of entries) {
      const key = groupKey(new Date(entry.created_at), groupBy)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(entry)
    }
    return [...map.entries()]
  }, [entries, groupBy])

  const open = (path: string) => {
    openNote(path)
    setMainView('editor')
  }

  return (
    <div className="h-full overflow-auto p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <History size={18} className="text-[var(--color-accent)]" />
          <h1 className="text-lg font-semibold">Activity</h1>
        </div>
        <div className="flex items-center gap-1 text-xs">
          {(['day', 'week', 'month'] as GroupBy[]).map((g) => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className="px-2 py-1 rounded"
              style={{
                background: groupBy === g ? 'var(--color-accent-soft)' : 'transparent',
                color: groupBy === g ? 'var(--color-accent)' : 'var(--color-text-muted)',
              }}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-[var(--color-text-faint)] mb-6">
        A local, private record of what happened in this vault — nothing here leaves your machine.
      </p>

      {groups.length === 0 && <div className="text-sm text-[var(--color-text-faint)]">No activity recorded yet.</div>}

      <div className="space-y-6">
        {groups.map(([label, items]) => (
          <div key={label}>
            <div className="text-xs font-semibold uppercase text-[var(--color-text-faint)] mb-2">{label}</div>
            <div className="space-y-1 border-l pl-4" style={{ borderColor: 'var(--color-border)' }}>
              {items.map((entry) => {
                const Icon = ACTION_ICON[entry.action] ?? FileEdit
                const time = new Date(entry.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                const displayPath = entry.action === 'rename' || entry.action === 'move' ? entry.detail.split(' ')[0] || entry.note_path : entry.note_path
                return (
                  <button
                    key={entry.id}
                    onClick={() => open(displayPath)}
                    className="w-full flex items-center gap-2.5 py-1.5 text-left hover:bg-[var(--color-bg-inset)] rounded px-2 -ml-2"
                  >
                    <span className="text-xs font-mono text-[var(--color-text-faint)] w-12 shrink-0">{time}</span>
                    <Icon size={13} className="text-[var(--color-text-muted)] shrink-0" />
                    <span className="text-sm truncate">
                      {ACTION_LABEL[entry.action] ?? entry.action} <span className="text-[var(--color-text-muted)]">{entry.note_path}</span>
                      {entry.detail && (entry.action === 'rename' || entry.action === 'move') && (
                        <span className="text-[var(--color-text-faint)]"> → {entry.detail}</span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
