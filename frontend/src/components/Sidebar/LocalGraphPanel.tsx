import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { useVaultStore } from '@/store/vaultStore'
import { useSettingsStore } from '@/store/settingsStore'
import { GraphView } from '@/components/Graph/GraphView'
import type { GraphData } from '@/types'

interface Props {
  path: string
  onOpenNote: (path: string) => void
}

export function LocalGraphPanel({ path, onOpenNote }: Props) {
  const vault = useVaultStore((s) => s.currentVault)
  const depth = useSettingsStore((s) => s.graph.depth)
  const updateGraph = useSettingsStore((s) => s.updateGraph)
  const [data, setData] = useState<GraphData | null>(null)

  useEffect(() => {
    if (!vault) return
    api.localGraph(vault.id, path, depth).then(setData)
  }, [vault, path, depth])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b text-xs" style={{ borderColor: 'var(--color-border)' }}>
        <span className="text-[var(--color-text-faint)]">Depth</span>
        <div className="flex gap-1">
          {[1, 2, 3, -1].map((d) => (
            <button
              key={d}
              onClick={() => updateGraph({ depth: d })}
              className="min-w-6 h-6 px-1.5 rounded text-xs"
              style={{
                background: depth === d ? 'var(--color-accent-soft)' : 'transparent',
                color: depth === d ? 'var(--color-accent)' : 'var(--color-text-muted)',
              }}
            >
              {d === -1 ? 'All' : d}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {data && (
          <GraphView
            data={data}
            focusPath={path}
            onNodeClick={(_id, node) => {
              if (node.path) onOpenNote(node.path)
            }}
          />
        )}
      </div>
    </div>
  )
}
