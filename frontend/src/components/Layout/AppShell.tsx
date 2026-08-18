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
import { CommandPalette } from '@/components/CommandPalette/CommandPalette'
import { QuickSwitcher } from '@/components/Search/QuickSwitcher'
import { SearchPanel } from '@/components/Search/SearchPanel'
import { SettingsModal } from '@/components/Settings/SettingsModal'
import { VaultSwitcherModal } from '@/components/VaultSwitcher/VaultSwitcherModal'

// The graph view pulls in cytoscape, a sizeable dependency most sessions
// never touch (Section 25: lazy loading). Split it into its own chunk.
const GlobalGraphPage = lazy(() =>
  import('@/components/Graph/GlobalGraphPage').then((m) => ({ default: m.GlobalGraphPage })),
)

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
    <div className="h-full flex flex-col">
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
          <TopBar />
          <div className="flex-1 min-h-0 flex">
            {leftOpen && (
              <div
                className={isMobile ? 'fixed inset-y-11 left-0 z-30 w-64 border-r' : 'w-64 shrink-0 border-r'}
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-elevated)' }}
              >
                <FileExplorer />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {mainView === 'graph' ? (
                <Suspense fallback={<div className="h-full flex items-center justify-center text-[var(--color-text-faint)]">Loading graph…</div>}>
                  <GlobalGraphPage />
                </Suspense>
              ) : (
                <WorkspaceArea />
              )}
            </div>
            {rightOpen && !isMobile && (
              <div className="w-72 shrink-0 border-l" style={{ borderColor: 'var(--color-border)' }}>
                <RightSidebar activePath={activePane?.activePath ?? null} onOpenNote={(p) => openNote(p)} />
              </div>
            )}
          </div>
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
