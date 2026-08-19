import { create } from 'zustand'

export type EditorMode = 'edit' | 'preview' | 'split'
export type RightPanelTab = 'backlinks' | 'outline' | 'tags' | 'local-graph' | 'ai'
export type MainView = 'editor' | 'graph' | 'canvas' | 'health' | 'tags' | 'collections' | 'activity'

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
  focusMode: boolean // Section 48: hides sidebars/graph/toolbar, keeps status bar
  zenMode: boolean // Section 49: focus mode + no HUD/status bar at all
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
  toggleFocusMode: () => void
  toggleZenMode: () => void
  exitFocusModes: () => void
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
  focusMode: false,
  zenMode: false,

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
  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode, zenMode: false })),
  toggleZenMode: () => set((s) => ({ zenMode: !s.zenMode, focusMode: false })),
  exitFocusModes: () => set({ focusMode: false, zenMode: false }),
}))
