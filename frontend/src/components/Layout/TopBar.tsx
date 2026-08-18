import { ArrowLeft, ArrowRight, PanelLeft, PanelRight, Search, Command, Settings, Share2, Sparkles, CalendarDays } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useVaultStore } from '@/store/vaultStore'
import { useSettingsStore } from '@/store/settingsStore'
import { api } from '@/api/client'

export function TopBar() {
  const toggleLeftSidebar = useUIStore((s) => s.toggleLeftSidebar)
  const toggleRightSidebar = useUIStore((s) => s.toggleRightSidebar)
  const setSearchPanelOpen = useUIStore((s) => s.setSearchPanelOpen)
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const setVaultSwitcherOpen = useUIStore((s) => s.setVaultSwitcherOpen)
  const mainView = useUIStore((s) => s.mainView)
  const setMainView = useUIStore((s) => s.setMainView)

  const back = useWorkspaceStore((s) => s.back)
  const forward = useWorkspaceStore((s) => s.forward)
  const canBack = useWorkspaceStore((s) => s.canGoBack())
  const canForward = useWorkspaceStore((s) => s.canGoForward())
  const openNote = useWorkspaceStore((s) => s.openNote)

  const vault = useVaultStore((s) => s.currentVault)
  const refreshTree = useVaultStore((s) => s.refreshTree)
  const dailyNotes = useSettingsStore((s) => s.dailyNotes)

  const createDailyNote = async () => {
    if (!vault) return
    const res = await api.openDailyNote(vault.id, {
      folder: dailyNotes.folder,
      date_format: dailyNotes.dateFormat,
      template_path: dailyNotes.templatePath || undefined,
    })
    await refreshTree()
    openNote(res.path)
  }

  return (
    <div
      className="flex items-center justify-between h-11 px-2 border-b shrink-0"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-elevated)' }}
    >
      <div className="flex items-center gap-0.5">
        <button title="Toggle left sidebar" onClick={toggleLeftSidebar} className="p-1.5 rounded hover:bg-[var(--color-bg-inset)]">
          <PanelLeft size={16} />
        </button>
        <button title="Back (Alt+←)" onClick={back} disabled={!canBack} className="p-1.5 rounded hover:bg-[var(--color-bg-inset)] disabled:opacity-30">
          <ArrowLeft size={16} />
        </button>
        <button title="Forward (Alt+→)" onClick={forward} disabled={!canForward} className="p-1.5 rounded hover:bg-[var(--color-bg-inset)] disabled:opacity-30">
          <ArrowRight size={16} />
        </button>
        <button
          title="Switch vault"
          onClick={() => setVaultSwitcherOpen(true)}
          className="flex items-center gap-1.5 px-2 py-1 ml-1 rounded-md hover:bg-[var(--color-bg-inset)] text-sm"
        >
          <Sparkles size={13} className="text-[var(--color-accent)]" />
          {vault?.name ?? 'No vault'}
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          title="Graph view (Ctrl+Shift+G)"
          onClick={() => setMainView(mainView === 'graph' ? 'editor' : 'graph')}
          className="p-1.5 rounded hover:bg-[var(--color-bg-inset)]"
          style={{ color: mainView === 'graph' ? 'var(--color-accent)' : undefined }}
        >
          <Share2 size={16} />
        </button>
        <button title="Daily note" onClick={createDailyNote} className="p-1.5 rounded hover:bg-[var(--color-bg-inset)]">
          <CalendarDays size={16} />
        </button>
        <button title="Search (Ctrl+Shift+F)" onClick={() => setSearchPanelOpen(true)} className="p-1.5 rounded hover:bg-[var(--color-bg-inset)]">
          <Search size={16} />
        </button>
        <button title="Command palette (Ctrl+K)" onClick={() => setCommandPaletteOpen(true)} className="p-1.5 rounded hover:bg-[var(--color-bg-inset)]">
          <Command size={16} />
        </button>
        <button title="Settings (Ctrl+,)" onClick={() => setSettingsOpen(true)} className="p-1.5 rounded hover:bg-[var(--color-bg-inset)]">
          <Settings size={16} />
        </button>
        <button title="Toggle right sidebar" onClick={toggleRightSidebar} className="p-1.5 rounded hover:bg-[var(--color-bg-inset)]">
          <PanelRight size={16} />
        </button>
      </div>
    </div>
  )
}
