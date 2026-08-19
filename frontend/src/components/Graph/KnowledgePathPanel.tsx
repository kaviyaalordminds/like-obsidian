import { useState } from 'react'
import { Route, X } from 'lucide-react'
import { api } from '@/api/client'
import { useVaultStore } from '@/store/vaultStore'
import { flattenFiles } from '@/lib/tree'
import type { GraphData } from '@/types'

interface Props {
  vaultId: string
  onClose: () => void
  onPathFound: (path: GraphData | null) => void
}

export function KnowledgePathPanel({ vaultId, onClose, onPathFound }: Props) {
  const tree = useVaultStore((s) => s.tree)
  const files = flattenFiles(tree).filter((f) => f.is_markdown)
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const [status, setStatus] = useState<'idle' | 'searching' | 'found' | 'none'>('idle')
  const [pathTitles, setPathTitles] = useState<string[]>([])

  const findPath = async () => {
    if (!source || !target) return
    setStatus('searching')
    try {
      const result = await api.knowledgePath(vaultId, source, target)
      setPathTitles(result.nodes.map((n) => n.title))
      onPathFound(result)
      setStatus('found')
    } catch {
      onPathFound(null)
      setPathTitles([])
      setStatus('none')
    }
  }

  return (
    <div className="glass-panel rounded-lg p-4 w-80 pointer-events-auto text-sm" style={{ boxShadow: 'var(--shadow-glow)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase text-[var(--color-text-faint)] flex items-center gap-1.5">
          <Route size={13} /> Knowledge Path
        </span>
        <button
          onClick={() => {
            onPathFound(null)
            onClose()
          }}
          className="p-1 rounded hover:bg-[var(--color-bg-inset)]"
        >
          <X size={13} />
        </button>
      </div>

      <div className="space-y-2">
        <select value={source} onChange={(e) => setSource(e.target.value)} className="settings-select w-full">
          <option value="">Start note…</option>
          {files.map((f) => (
            <option key={f.path} value={f.path}>
              {f.name.replace(/\.md$/i, '')}
            </option>
          ))}
        </select>
        <select value={target} onChange={(e) => setTarget(e.target.value)} className="settings-select w-full">
          <option value="">End note…</option>
          {files.map((f) => (
            <option key={f.path} value={f.path}>
              {f.name.replace(/\.md$/i, '')}
            </option>
          ))}
        </select>
        <button
          onClick={findPath}
          disabled={!source || !target}
          className="w-full py-1.5 rounded-md text-sm text-white disabled:opacity-40"
          style={{ background: 'var(--color-accent)' }}
        >
          Find path
        </button>
      </div>

      {status === 'none' && <div className="mt-3 text-xs text-[var(--color-danger)]">No connection exists between these notes.</div>}
      {status === 'found' && (
        <div className="mt-3 text-xs text-[var(--color-text-muted)] flex flex-wrap items-center gap-1">
          {pathTitles.map((t, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="text-[var(--color-accent)]">{t}</span>
              {i < pathTitles.length - 1 && <span>→</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
