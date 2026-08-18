import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import {
  FilePlus,
  FolderPlus,
  Share2,
  Search,
  Settings,
  PanelLeft,
  Eye,
  CalendarDays,
  Upload,
  Download,
  SunMoon,
  Sparkles,
} from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useVaultStore } from '@/store/vaultStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useSettingsStore } from '@/store/settingsStore'
import { api } from '@/api/client'
import { createUntitledNote, uniquePath } from '@/lib/noteCreation'
import { flattenFiles } from '@/lib/tree'

export function CommandPalette() {
  const open = useUIStore((s) => s.commandPaletteOpen)
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen)
  const setSearchPanelOpen = useUIStore((s) => s.setSearchPanelOpen)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const setVaultSwitcherOpen = useUIStore((s) => s.setVaultSwitcherOpen)
  const toggleLeftSidebar = useUIStore((s) => s.toggleLeftSidebar)
  const cycleEditorMode = useUIStore((s) => s.cycleEditorMode)
  const setMainView = useUIStore((s) => s.setMainView)
  const mainView = useUIStore((s) => s.mainView)

  const vault = useVaultStore((s) => s.currentVault)
  const refreshTree = useVaultStore((s) => s.refreshTree)
  const openNote = useWorkspaceStore((s) => s.openNote)
  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)

  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  const run = (fn: () => void) => {
    fn()
    setOpen(false)
  }

  const createNote = async () => {
    if (!vault) return
    const note = await createUntitledNote(vault.id, useVaultStore.getState().tree)
    await refreshTree()
    openNote(note.path)
  }

  const createFolder = async () => {
    if (!vault) return
    const existing = new Set(flattenFiles(useVaultStore.getState().tree).map((f) => f.path))
    await api.createFolder(vault.id, uniquePath(existing, '', 'New Folder', ''))
    await refreshTree()
  }

  const createDailyNote = async () => {
    if (!vault) return
    const dailyNotes = useSettingsStore.getState().dailyNotes
    const res = await api.openDailyNote(vault.id, {
      folder: dailyNotes.folder,
      date_format: dailyNotes.dateFormat,
      template_path: dailyNotes.templatePath || undefined,
    })
    await refreshTree()
    openNote(res.path)
  }

  const exportVault = async () => {
    if (!vault) return
    const blob = await api.exportVault(vault.id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${vault.slug}.zip`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importVault = () => {
    if (!vault) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.zip'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      await api.importVault(vault.id, file)
      await refreshTree()
    }
    input.click()
  }

  // Not memoized: each action closes over live state (mainView/theme), and
  // rebuilding this small array is cheap relative to the churn of tracking
  // every closure as a useMemo dependency.
  const items = [
    { icon: FilePlus, label: 'Create note', action: createNote },
    { icon: FolderPlus, label: 'Create folder', action: createFolder },
    { icon: Share2, label: mainView === 'graph' ? 'Back to editor' : 'Open graph', action: () => setMainView(mainView === 'graph' ? 'editor' : 'graph') },
    { icon: Share2, label: 'Open local graph', action: () => useUIStore.getState().setRightPanelTab('local-graph') },
    { icon: Search, label: 'Search vault', action: () => setSearchPanelOpen(true) },
    { icon: Settings, label: 'Open settings', action: () => setSettingsOpen(true) },
    { icon: PanelLeft, label: 'Toggle sidebar', action: toggleLeftSidebar },
    { icon: Eye, label: 'Toggle preview', action: cycleEditorMode },
    { icon: CalendarDays, label: 'Create daily note', action: createDailyNote },
    { icon: Upload, label: 'Import vault', action: importVault },
    { icon: Download, label: 'Export vault', action: exportVault },
    { icon: SunMoon, label: 'Toggle theme', action: () => setTheme(theme === 'dark' ? 'light' : 'dark') },
    { icon: Sparkles, label: 'Switch vault', action: () => setVaultSwitcherOpen(true) },
  ]

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      shouldFilter
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
    >
      <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <div
        className="relative w-full max-w-lg rounded-xl border overflow-hidden"
        style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-glow)' }}
      >
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder="Type a command…"
          className="w-full px-4 py-3 bg-transparent outline-none border-b text-sm"
          style={{ borderColor: 'var(--color-border)' }}
        />
        <Command.List className="max-h-80 overflow-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-[var(--color-text-faint)]">No results.</Command.Empty>
          {items.map(({ icon: Icon, label, action }) => (
            <Command.Item
              key={label}
              onSelect={() => run(action)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer data-[selected=true]:bg-[var(--color-accent-soft)] data-[selected=true]:text-[var(--color-accent)]"
            >
              <Icon size={15} />
              {label}
            </Command.Item>
          ))}
        </Command.List>
      </div>
    </Command.Dialog>
  )
}
