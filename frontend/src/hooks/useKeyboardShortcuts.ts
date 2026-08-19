import { useEffect } from 'react'
import { useUIStore } from '@/store/uiStore'
import { useVaultStore } from '@/store/vaultStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useNoteStore } from '@/store/noteStore'
import { createUntitledNote } from '@/lib/noteCreation'

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey

      if (mod && (e.key === 'p' || e.key === 'o')) {
        e.preventDefault()
        useUIStore.getState().setQuickSwitcherOpen(true)
        return
      }
      if (mod && e.key === 'k') {
        e.preventDefault()
        useUIStore.getState().setCommandPaletteOpen(true)
        return
      }
      if (mod && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault()
        useUIStore.getState().setSearchPanelOpen(true)
        return
      }
      if (mod && e.shiftKey && (e.key === 'G' || e.key === 'g')) {
        e.preventDefault()
        const ui = useUIStore.getState()
        ui.setMainView(ui.mainView === 'graph' ? 'editor' : 'graph')
        return
      }
      if (mod && e.shiftKey && e.key === 'F11') {
        e.preventDefault()
        useUIStore.getState().toggleFocusMode()
        return
      }
      if (mod && e.key === ',') {
        e.preventDefault()
        useUIStore.getState().setSettingsOpen(true)
        return
      }
      if (mod && (e.key === 'n' || e.key === 'N') && !e.shiftKey) {
        e.preventDefault()
        const { currentVault, tree, refreshTree } = useVaultStore.getState()
        if (!currentVault) return
        const note = await createUntitledNote(currentVault.id, tree)
        await refreshTree()
        useWorkspaceStore.getState().openNote(note.path)
        return
      }
      if (mod && e.key === 's') {
        e.preventDefault()
        const vault = useVaultStore.getState().currentVault
        const pane = useWorkspaceStore.getState().panes.find((p) => p.id === useWorkspaceStore.getState().activePaneId)
        if (vault && pane?.activePath) useNoteStore.getState().saveNow(vault.id, pane.activePath)
        return
      }
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault()
        useWorkspaceStore.getState().back()
        return
      }
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault()
        useWorkspaceStore.getState().forward()
        return
      }
      if (e.key === 'Escape') {
        const ui = useUIStore.getState()
        if (ui.commandPaletteOpen) ui.setCommandPaletteOpen(false)
        if (ui.quickSwitcherOpen) ui.setQuickSwitcherOpen(false)
        if (ui.searchPanelOpen) ui.setSearchPanelOpen(false)
        if (ui.focusMode || ui.zenMode) ui.exitFocusModes()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
