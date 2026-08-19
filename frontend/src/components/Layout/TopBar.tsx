import {
  ArrowLeft,
  ArrowRight,
  PanelLeft,
  PanelRight,
  Search,
  Command,
  Settings,
  Share2,
  Sparkles,
  CalendarDays,
  FileText,
  LayoutDashboard,
  Hash,
  Layers,
  History,
  HeartPulse,
  Focus,
  Minimize2,
} from 'lucide-react'
import { useUIStore, type MainView } from '@/store/uiStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useVaultStore } from '@/store/vaultStore'
import { useSettingsStore } from '@/store/settingsStore'
import { api } from '@/api/client'

const NAV: { id: MainView; label: string; icon: React.ComponentType<{ size?: number }>; shortcut?: string }[] = [
  { id: 'editor', label: 'Notes', icon: FileText },
  { id: 'graph', label: 'Graph', icon: Share2, shortcut: 'Ctrl+Shift+G' },
  { id: 'canvas', label: 'Canvas', icon: LayoutDashboard },
  { id: 'tags', label: 'Tags', icon: Hash },
  { id: 'collections', label: 'Collections', icon: Layers },
  { id: 'activity', label: 'Activity', icon: History },
  { id: 'health', label: 'Knowledge Health', icon: HeartPulse },
]

export function TopBar() {
  const toggleLeftSidebar = useUIStore((s) => s.toggleLeftSidebar)
  const toggleRightSidebar = useUIStore((s) => s.toggleRightSidebar)
  const setSearchPanelOpen = useUIStore((s) => s.setSearchPanelOpen)
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const setVaultSwitcherOpen = useUIStore((s) => s.setVaultSwitcherOpen)
  const mainView = useUIStore((s) => s.mainView)
  const setMainView = useUIStore((s) => s.setMainView)
  const toggleFocusMode = useUIStore((s) => s.toggleFocusMode)
  const toggleZenMode = useUIStore((s) => s.toggleZenMode)

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

      <div className="hidden md:flex items-center gap-0.5">
        {NAV.map(({ id, label, icon: Icon, shortcut }) => (
          <button
            key={id}
            title={shortcut ? `${label} (${shortcut})` : label}
            onClick={() => setMainView(id)}
            className="p-1.5 rounded hover:bg-[var(--color-bg-inset)]"
            style={{ color: mainView === id ? 'var(--color-accent)' : undefined, background: mainView === id ? 'var(--color-accent-soft)' : undefined }}
          >
            <Icon size={16} />
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <button title="Daily note" onClick={createDailyNote} className="p-1.5 rounded hover:bg-[var(--color-bg-inset)]">
          <CalendarDays size={16} />
        </button>
        <button title="Search (Ctrl+Shift+F)" onClick={() => setSearchPanelOpen(true)} className="p-1.5 rounded hover:bg-[var(--color-bg-inset)]">
          <Search size={16} />
        </button>
        <button title="Command palette (Ctrl+K)" onClick={() => setCommandPaletteOpen(true)} className="p-1.5 rounded hover:bg-[var(--color-bg-inset)]">
          <Command size={16} />
        </button>
        <button title="Focus mode (Ctrl+Shift+F11)" onClick={toggleFocusMode} className="p-1.5 rounded hover:bg-[var(--color-bg-inset)]">
          <Focus size={16} />
        </button>
        <button title="Zen mode" onClick={toggleZenMode} className="p-1.5 rounded hover:bg-[var(--color-bg-inset)]">
          <Minimize2 size={16} />
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
