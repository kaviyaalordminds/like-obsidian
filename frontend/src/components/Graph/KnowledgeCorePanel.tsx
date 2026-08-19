import { useEffect, useState } from 'react'
import { Layers, X } from 'lucide-react'
import { api } from '@/api/client'
import type { GraphCluster, GraphStats } from '@/types'

interface Props {
  vaultId: string
  clusterStrategy: 'folder' | 'connected'
  onClose: () => void
  onSelectNote: (id: string) => void
}

/** "Highly connected knowledge, at a glance" — every list here is read
 * straight off already-computed graph/tag/cluster data (Part 20), never
 * invented or hardcoded. */
export function KnowledgeCorePanel({ vaultId, clusterStrategy, onClose, onSelectNote }: Props) {
  const [stats, setStats] = useState<GraphStats | null>(null)
  const [tags, setTags] = useState<[string, number][]>([])
  const [clusters, setClusters] = useState<GraphCluster[]>([])

  useEffect(() => {
    api.graphStats(vaultId, clusterStrategy).then(setStats)
    api.listTags(vaultId).then((t) => setTags(Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 5)))
    api.graphClusters(vaultId, clusterStrategy).then((c) =>
      setClusters([...c].sort((a, b) => b.node_ids.length - a.node_ids.length).slice(0, 5)),
    )
  }, [vaultId, clusterStrategy])

  return (
    <div className="w-72 glass-panel rounded-lg p-3 max-h-[70vh] overflow-auto" style={{ boxShadow: 'var(--shadow-glow)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase text-[var(--color-text-faint)]">
          <Layers size={12} /> Knowledge core
        </span>
        <button onClick={onClose} className="p-1 rounded hover:bg-[var(--color-bg-inset)]">
          <X size={13} />
        </button>
      </div>

      <Section title="Top notes">
        {(stats?.most_connected ?? []).length === 0 && <Empty />}
        {(stats?.most_connected ?? []).map((n) => (
          <button
            key={n.id}
            onClick={() => onSelectNote(n.id)}
            className="w-full flex items-center justify-between text-left px-1.5 py-1 rounded text-xs hover:bg-[var(--color-bg-inset)]"
          >
            <span className="truncate">{n.title}</span>
            <span className="text-[var(--color-text-faint)] shrink-0 ml-2">{n.connections}</span>
          </button>
        ))}
      </Section>

      <Section title="Top tags">
        {tags.length === 0 && <Empty />}
        {tags.map(([tag, count]) => (
          <div key={tag} className="flex items-center justify-between px-1.5 py-1 text-xs">
            <span className="truncate text-[var(--color-accent)]">#{tag}</span>
            <span className="text-[var(--color-text-faint)] shrink-0 ml-2">{count}</span>
          </div>
        ))}
      </Section>

      <Section title="Top clusters">
        {clusters.length === 0 && <Empty />}
        {clusters.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-1.5 py-1 text-xs">
            <span className="truncate">{c.label}</span>
            <span className="text-[var(--color-text-faint)] shrink-0 ml-2">{c.node_ids.length}</span>
          </div>
        ))}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="text-xs font-semibold uppercase text-[var(--color-text-faint)] mb-1">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function Empty() {
  return <div className="px-1.5 py-1 text-xs text-[var(--color-text-faint)]">Not enough data yet.</div>
}
