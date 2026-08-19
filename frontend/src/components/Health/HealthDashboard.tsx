import { useEffect, useState } from 'react'
import { AlertTriangle, Link2Off, Copy, Ghost, HeartPulse } from 'lucide-react'
import { api } from '@/api/client'
import { useVaultStore } from '@/store/vaultStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useUIStore } from '@/store/uiStore'
import type { BrokenLinkGroup, DuplicateCandidate, HealthReport, OrphanNote } from '@/types'

type Tab = 'overview' | 'orphans' | 'broken' | 'duplicates'

export function HealthDashboard() {
  const vault = useVaultStore((s) => s.currentVault)
  const openNote = useWorkspaceStore((s) => s.openNote)
  const setMainView = useUIStore((s) => s.setMainView)
  const [tab, setTab] = useState<Tab>('overview')
  const [report, setReport] = useState<HealthReport | null>(null)
  const [orphans, setOrphans] = useState<OrphanNote[]>([])
  const [broken, setBroken] = useState<BrokenLinkGroup[]>([])
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([])

  const load = () => {
    if (!vault) return
    api.health(vault.id).then(setReport)
    api.orphans(vault.id).then(setOrphans)
    api.brokenLinks(vault.id).then(setBroken)
    api.duplicates(vault.id).then(setDuplicates)
  }

  useEffect(load, [vault])

  const open = (path: string) => {
    openNote(path)
    setMainView('editor')
  }

  const createFromBroken = async (target: string) => {
    if (!vault) return
    const note = await api.createNote(vault.id, `${target}.md`, `# ${target}\n\n`)
    await useVaultStore.getState().refreshTree()
    open(note.path)
    load()
  }

  if (!vault) return null

  return (
    <div className="h-full overflow-auto p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <HeartPulse size={18} className="text-[var(--color-accent)]" />
        <h1 className="text-lg font-semibold">Knowledge Health</h1>
      </div>
      <p className="text-sm text-[var(--color-text-faint)] mb-5">
        Live metrics computed from your vault — nothing here is cached or estimated.
      </p>

      <div className="flex items-center gap-1 mb-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
        {(
          [
            ['overview', 'Overview'],
            ['orphans', `Orphans (${orphans.length})`],
            ['broken', `Broken links (${broken.length})`],
            ['duplicates', `Duplicates (${duplicates.length})`],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="px-3 py-2 text-sm"
            style={{
              color: tab === id ? 'var(--color-accent)' : 'var(--color-text-muted)',
              borderBottom: tab === id ? '2px solid var(--color-accent)' : '2px solid transparent',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && report && (
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-3">
            <Metric label="Orphans" value={report.orphan_count} />
            <Metric label="Broken links" value={report.broken_link_count} />
            <Metric label="Duplicates" value={report.duplicate_count} />
            <Metric label="Unused tags" value={report.unused_tag_count} />
            <Metric label="Empty notes" value={report.empty_note_count} />
            <Metric label="Large notes" value={report.large_note_count} />
            <Metric label="Stale (1yr+)" value={report.old_note_count} />
            <Metric label="No metadata" value={report.no_metadata_count} />
          </div>

          <div>
            <div className="text-xs font-semibold uppercase text-[var(--color-text-faint)] mb-2">Recommendations</div>
            {report.recommendations.length === 0 ? (
              <div className="text-sm text-[var(--color-text-faint)] flex items-center gap-2">
                <HeartPulse size={14} className="text-[var(--color-accent)]" /> Your vault looks healthy.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {report.recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-muted)]">
                    <AlertTriangle size={14} className="text-[var(--color-unresolved)] mt-0.5 shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === 'orphans' && (
        <div className="space-y-1">
          {orphans.length === 0 && <Empty icon={Ghost} text="No orphan notes — everything is connected." />}
          {orphans.map((o) => (
            <button
              key={o.path}
              onClick={() => open(o.path)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-[var(--color-bg-inset)] text-left text-sm"
            >
              <span>{o.title}</span>
              <span className="text-xs text-[var(--color-text-faint)]">{o.folder || '/'}</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'broken' && (
        <div className="space-y-3">
          {broken.length === 0 && <Empty icon={Link2Off} text="No broken links found." />}
          {broken.map((b) => (
            <div key={b.target} className="p-3 rounded-md border" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-sm text-[var(--color-unresolved)]">[[{b.target}]]</span>
                <button
                  onClick={() => createFromBroken(b.target)}
                  className="text-xs px-2 py-1 rounded text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]"
                >
                  Create note
                </button>
              </div>
              <div className="text-xs text-[var(--color-text-faint)] mb-1">Referenced from:</div>
              <div className="flex flex-wrap gap-1.5">
                {b.referenced_from.map((r) => (
                  <button
                    key={r.path}
                    onClick={() => open(r.path)}
                    className="text-xs px-2 py-1 rounded bg-[var(--color-bg-inset)] hover:text-[var(--color-accent)]"
                  >
                    {r.title}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'duplicates' && (
        <div className="space-y-2">
          {duplicates.length === 0 && <Empty icon={Copy} text="No likely duplicates detected." />}
          {duplicates.map((d, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-md border text-sm" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-2">
                <button onClick={() => open(d.a.path)} className="hover:text-[var(--color-accent)]">
                  {d.a.title}
                </button>
                <span className="text-[var(--color-text-faint)]">↔</span>
                <button onClick={() => open(d.b.path)} className="hover:text-[var(--color-accent)]">
                  {d.b.title}
                </button>
              </div>
              <span className="text-xs text-[var(--color-text-faint)]">{Math.round(d.similarity * 100)}% similar</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-panel rounded-lg p-3" style={{ boxShadow: 'var(--shadow-glow)' }}>
      <div className="text-2xl font-mono font-semibold">{value}</div>
      <div className="text-xs text-[var(--color-text-faint)] mt-0.5">{label}</div>
    </div>
  )
}

function Empty({ icon: Icon, text }: { icon: React.ComponentType<{ size?: number }>; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-[var(--color-text-faint)] py-6 justify-center">
      <Icon size={14} />
      {text}
    </div>
  )
}
