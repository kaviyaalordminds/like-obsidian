import { Suspense, lazy } from 'react'
import { Link2, List, Hash, Share2, Bot } from 'lucide-react'
import { useUIStore, type RightPanelTab } from '@/store/uiStore'
import { BacklinksPanel } from './BacklinksPanel'
import { OutlinePanel } from './OutlinePanel'
import { TagsPanel } from './TagsPanel'
import { AIChatPanel } from '@/components/AI/AIChatPanel'

// Pulls in cytoscape; keep it out of the main bundle until the tab is opened.
const LocalGraphPanel = lazy(() => import('./LocalGraphPanel').then((m) => ({ default: m.LocalGraphPanel })))

interface Props {
  activePath: string | null
  onOpenNote: (path: string) => void
}

const tabs: { id: RightPanelTab; icon: React.ComponentType<{ size?: number }>; label: string }[] = [
  { id: 'backlinks', icon: Link2, label: 'Backlinks' },
  { id: 'outline', icon: List, label: 'Outline' },
  { id: 'tags', icon: Hash, label: 'Tags' },
  { id: 'local-graph', icon: Share2, label: 'Local graph' },
  { id: 'ai', icon: Bot, label: 'AI Agent' },
]

export function RightSidebar({ activePath, onOpenNote }: Props) {
  const tab = useUIStore((s) => s.rightPanelTab)
  const setTab = useUIStore((s) => s.setRightPanelTab)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center border-b" style={{ borderColor: 'var(--color-border)' }}>
        {tabs.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            title={label}
            onClick={() => setTab(id)}
            className="flex-1 flex items-center justify-center py-2"
            style={{
              color: tab === id ? 'var(--color-accent)' : 'var(--color-text-faint)',
              borderBottom: tab === id ? '2px solid var(--color-accent)' : '2px solid transparent',
            }}
          >
            <Icon size={15} />
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        {tab === 'ai' ? (
          <AIChatPanel />
        ) : !activePath ? (
          <div className="p-3 text-xs text-[var(--color-text-faint)]">Open a note to see details.</div>
        ) : tab === 'backlinks' ? (
          <BacklinksPanel path={activePath} onOpenNote={onOpenNote} />
        ) : tab === 'outline' ? (
          <OutlinePanel path={activePath} />
        ) : tab === 'tags' ? (
          <TagsPanel onOpenNote={onOpenNote} />
        ) : (
          <Suspense fallback={<div className="p-3 text-xs text-[var(--color-text-faint)]">Loading graph…</div>}>
            <LocalGraphPanel path={activePath} onOpenNote={onOpenNote} />
          </Suspense>
        )}
      </div>
    </div>
  )
}
