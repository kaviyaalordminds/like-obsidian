import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import { api } from '@/api/client'
import type { GraphStats } from '@/types'

interface Props {
  vaultId: string
  clusterStrategy: 'folder' | 'connected'
  refreshKey: number
  onSelectMostConnected: (nodeId: string) => void
}

/** Every number here comes straight from GET /graph/stats, recomputed from
 * the live vault on each refresh — never hard-coded (Section 18). */
export function GraphHUD({ vaultId, clusterStrategy, refreshKey, onSelectMostConnected }: Props) {
  const [stats, setStats] = useState<GraphStats | null>(null)

  useEffect(() => {
    api.graphStats(vaultId, clusterStrategy).then(setStats)
  }, [vaultId, clusterStrategy, refreshKey])

  if (!stats) return null

  return (
    <div
      className="glass-panel rounded-lg px-3.5 py-3 text-xs font-mono w-56 pointer-events-auto"
      style={{ boxShadow: 'var(--shadow-glow)' }}
    >
      <div className="flex items-center gap-1.5 mb-2 text-[var(--color-accent)] tracking-wide">
        <Activity size={12} />
        <span className="uppercase font-semibold">Knowledge Network</span>
      </div>
      <dl className="space-y-1 text-[var(--color-text-muted)]">
        <Row label="Nodes" value={stats.node_count.toLocaleString()} />
        <Row label="Connections" value={stats.edge_count.toLocaleString()} />
        <Row label="Clusters" value={stats.cluster_count.toLocaleString()} />
        <Row label="Orphans" value={stats.orphan_count.toLocaleString()} />
        <Row label="Density" value={`${(stats.density * 100).toFixed(1)}%`} />
        <Row label="Avg links" value={stats.avg_connections.toFixed(2)} />
      </dl>
      {stats.most_connected.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div className="text-[10px] uppercase text-[var(--color-text-faint)] mb-1">Most connected</div>
          <div className="space-y-0.5">
            {stats.most_connected.slice(0, 4).map((n) => (
              <button
                key={n.id}
                onClick={() => onSelectMostConnected(n.id)}
                className="w-full flex items-center justify-between text-left hover:text-[var(--color-accent)] truncate"
              >
                <span className="truncate">{n.title}</span>
                <span className="text-[var(--color-text-faint)] ml-2 shrink-0">{n.connections}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt>{label}</dt>
      <dd className="text-[var(--color-text)]">{value}</dd>
    </div>
  )
}
