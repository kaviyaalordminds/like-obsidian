import { create } from 'zustand'

export type EditorMode = 'edit' | 'preview' | 'split'
export type RightPanelTab = 'backlinks' | 'outline' | 'tags' | 'local-graph'
export type MainView = 'editor' | 'graph'

interface UIState {
  mainView: MainView
  leftSidebarOpen: boolean
  rightSidebarOpen: boolean
  rightPanelTab: RightPanelTab
  editorMode: EditorMode
  commandPaletteOpen: boolean
  quickSwitcherOpen: boolean
  searchPanelOpen: boolean
  settingsOpen: boolean
  vaultSwitcherOpen: boolean
  setMainView: (view: MainView) => void

  toggleLeftSidebar: () => void
  toggleRightSidebar: () => void
  setRightPanelTab: (tab: RightPanelTab) => void
  setEditorMode: (mode: EditorMode) => void
  cycleEditorMode: () => void
  setCommandPaletteOpen: (open: boolean) => void
  setQuickSwitcherOpen: (open: boolean) => void
  setSearchPanelOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setVaultSwitcherOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  mainView: 'editor',
  leftSidebarOpen: true,
  rightSidebarOpen: true,
  rightPanelTab: 'backlinks',
  editorMode: 'split',
  commandPaletteOpen: false,
  quickSwitcherOpen: false,
  searchPanelOpen: false,
  settingsOpen: false,
  vaultSwitcherOpen: false,

  setMainView: (view) => set({ mainView: view }),
  toggleLeftSidebar: () => set((s) => ({ leftSidebarOpen: !s.leftSidebarOpen })),
  toggleRightSidebar: () => set((s) => ({ rightSidebarOpen: !s.rightSidebarOpen })),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab, rightSidebarOpen: true }),
  setEditorMode: (mode) => set({ editorMode: mode }),
  cycleEditorMode: () =>
    set((s) => ({
      editorMode: s.editorMode === 'edit' ? 'split' : s.editorMode === 'split' ? 'preview' : 'edit',
    })),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setQuickSwitcherOpen: (open) => set({ quickSwitcherOpen: open }),
  setSearchPanelOpen: (open) => set({ searchPanelOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setVaultSwitcherOpen: (open) => set({ vaultSwitcherOpen: open }),
}))
