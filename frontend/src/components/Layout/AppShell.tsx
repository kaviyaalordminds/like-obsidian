import { Suspense, lazy, useEffect, useState } from 'react'
import { useUIStore } from '@/store/uiStore'
import { useVaultStore } from '@/store/vaultStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { FileExplorer } from '@/components/FileExplorer/FileExplorer'
import { RightSidebar } from '@/components/Sidebar/RightSidebar'
import { WorkspaceArea } from './WorkspaceArea'
import { TopBar } from './TopBar'
import { StatusBar } from './StatusBar'
import { CommandPalette } from '@/components/CommandPalette/CommandPalette'
import { QuickSwitcher } from '@/components/Search/QuickSwitcher'
import { SearchPanel } from '@/components/Search/SearchPanel'
import { SettingsModal } from '@/components/Settings/SettingsModal'
import { VaultSwitcherModal } from '@/components/VaultSwitcher/VaultSwitcherModal'

// Each of these pulls in enough extra weight (cytoscape, the canvas board,
// list views) that most sessions never touch, so they're split into their
// own chunks rather than bundled into the initial load (Section 25).
const GlobalGraphPage = lazy(() =>
  import('@/components/Graph/GlobalGraphPage').then((m) => ({ default: m.GlobalGraphPage })),
)
const CanvasPage = lazy(() => import('@/components/Canvas/CanvasPage').then((m) => ({ default: m.CanvasPage })))
const HealthDashboard = lazy(() => import('@/components/Health/HealthDashboard').then((m) => ({ default: m.HealthDashboard })))
const TagIntelligencePage = lazy(() => import('@/components/Tags/TagIntelligencePage').then((m) => ({ default: m.TagIntelligencePage })))
const CollectionsPage = lazy(() => import('@/components/Collections/CollectionsPage').then((m) => ({ default: m.CollectionsPage })))
const ActivityPage = lazy(() => import('@/components/Activity/ActivityPage').then((m) => ({ default: m.ActivityPage })))

function LazyFallback() {
  return <div className="h-full flex items-center justify-center text-[var(--color-text-faint)]">Loading…</div>
}

export function AppShell() {
  const loadVaults = useVaultStore((s) => s.loadVaults)
  const currentVault = useVaultStore((s) => s.currentVault)
  const loading = useVaultStore((s) => s.loading)
  const vaults = useVaultStore((s) => s.vaults)
  const loadSettings = useSettingsStore((s) => s.loadFromVault)
  const leftOpen = useUIStore((s) => s.leftSidebarOpen)
  const rightOpen = useUIStore((s) => s.rightSidebarOpen)
  const mainView = useUIStore((s) => s.mainView)
  const setVaultSwitcherOpen = useUIStore((s) => s.setVaultSwitcherOpen)
  const openNote = useWorkspaceStore((s) => s.openNote)
  const activePane = useWorkspaceStore((s) => s.panes.find((p) => p.id === s.activePaneId))
  const showGrid = useSettingsStore((s) => s.effects.showGrid && s.effects.enabled)
  const focusMode = useUIStore((s) => s.focusMode)
  const zenMode = useUIStore((s) => s.zenMode)
  const exitFocusModes = useUIStore((s) => s.exitFocusModes)
  const distractionFree = focusMode || zenMode

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useKeyboardShortcuts()

  useEffect(() => {
    loadVaults()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (currentVault) loadSettings(currentVault.id)
  }, [currentVault, loadSettings])

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Every branch below renders inside the same tree (never as a competing
  // early return) so the modals — VaultSwitcherModal in particular — stay
  // mounted across loading/empty/loaded states. Unmounting it while it owns
  // an in-flight vault refresh previously caused a remount -> refetch ->
  // loading-flips-true -> unmount loop that hammered GET /api/vaults.
  return (
    <div className={`h-full flex flex-col ${showGrid ? 'bg-grid' : ''}`} style={{ background: 'var(--color-bg)' }}>
      {!currentVault ? (
        <div className="h-full flex flex-col items-center justify-center gap-4">
          <h1 className="text-xl font-semibold">Welcome</h1>
          <p className="text-sm text-[var(--color-text-faint)]">
            {loading && vaults.length === 0
              ? 'Loading your vaults…'
              : vaults.length === 0
                ? 'Create your first vault to get started.'
                : 'Select a vault to open.'}
          </p>
          <button
            onClick={() => setVaultSwitcherOpen(true)}
            className="px-4 py-2 rounded-md text-sm text-white"
            style={{ background: 'var(--color-accent)' }}
          >
            {vaults.length === 0 ? 'Create vault' : 'Open vault'}
          </button>
        </div>
      ) : (
        <>
          {!distractionFree && <TopBar />}
          {distractionFree && (
            <button
              onClick={exitFocusModes}
              title="Exit focus/zen mode"
              className="fixed top-2 right-2 z-50 px-2.5 py-1 rounded-md text-xs glass-panel"
              style={{ boxShadow: 'var(--shadow-glow)' }}
            >
              Exit {zenMode ? 'Zen' : 'Focus'} mode
            </button>
          )}
          <div className="flex-1 min-h-0 flex">
            {leftOpen && !distractionFree && (
              <div
                className={isMobile ? 'fixed inset-y-11 left-0 z-30 w-64 border-r' : 'w-64 shrink-0 border-r'}
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-elevated)' }}
              >
                <FileExplorer />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {mainView === 'graph' && !distractionFree ? (
                <Suspense fallback={<LazyFallback />}>
                  <GlobalGraphPage />
                </Suspense>
              ) : mainView === 'canvas' && !distractionFree ? (
                <Suspense fallback={<LazyFallback />}>
                  <CanvasPage />
                </Suspense>
              ) : mainView === 'health' && !distractionFree ? (
                <Suspense fallback={<LazyFallback />}>
                  <HealthDashboard />
                </Suspense>
              ) : mainView === 'tags' && !distractionFree ? (
                <Suspense fallback={<LazyFallback />}>
                  <TagIntelligencePage />
                </Suspense>
              ) : mainView === 'collections' && !distractionFree ? (
                <Suspense fallback={<LazyFallback />}>
                  <CollectionsPage />
                </Suspense>
              ) : mainView === 'activity' && !distractionFree ? (
                <Suspense fallback={<LazyFallback />}>
                  <ActivityPage />
                </Suspense>
              ) : (
                <WorkspaceArea />
              )}
            </div>
            {rightOpen && !isMobile && !distractionFree && (
              <div className="w-72 shrink-0 border-l" style={{ borderColor: 'var(--color-border)' }}>
                <RightSidebar activePath={activePane?.activePath ?? null} onOpenNote={(p) => openNote(p)} />
              </div>
            )}
          </div>
          {!zenMode && <StatusBar />}
          <CommandPalette />
          <QuickSwitcher />
          <SearchPanel />
          <SettingsModal />
        </>
      )}

      <VaultSwitcherModal />
    </div>
  )
}
