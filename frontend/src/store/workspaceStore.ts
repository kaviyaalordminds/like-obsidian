import { create } from 'zustand'

export interface Pane {
  id: string
  tabs: string[]
  pinned: string[]
  activePath: string | null
}

interface WorkspaceState {
  panes: Pane[]
  activePaneId: string
  history: string[]
  historyIndex: number
  recent: string[]

  openNote: (path: string, opts?: { newPane?: boolean; paneId?: string }) => void
  closeTab: (paneId: string, path: string) => void
  setActivePane: (paneId: string) => void
  activateTab: (paneId: string, path: string) => void
  togglePin: (paneId: string, path: string) => void
  splitPane: () => void
  closePane: (paneId: string) => void
  back: () => void
  forward: () => void
  canGoBack: () => boolean
  canGoForward: () => boolean
  renamePath: (oldPath: string, newPath: string) => void
  closeAllForPath: (path: string) => void
}

function makePane(): Pane {
  return { id: crypto.randomUUID(), tabs: [], pinned: [], activePath: null }
}

const initialPane = makePane()

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  panes: [initialPane],
  activePaneId: initialPane.id,
  history: [],
  historyIndex: -1,
  recent: [],

  openNote: (path, opts) => {
    set((s) => {
      let panes = s.panes
      let paneId = opts?.paneId ?? s.activePaneId

      if (opts?.newPane && panes.length < 2) {
        const newPane = { ...makePane(), tabs: [path], activePath: path }
        panes = [...panes, newPane]
        paneId = newPane.id
      } else {
        panes = panes.map((p) => {
          if (p.id !== paneId) return p
          const tabs = p.tabs.includes(path) ? p.tabs : [...p.tabs, path]
          return { ...p, tabs, activePath: path }
        })
      }

      const history = s.history.slice(0, s.historyIndex + 1)
      if (history[history.length - 1] !== path) history.push(path)
      const recent = [path, ...s.recent.filter((p) => p !== path)].slice(0, 30)

      return {
        panes,
        activePaneId: paneId,
        history,
        historyIndex: history.length - 1,
        recent,
      }
    })
  },

  closeTab: (paneId, path) => {
    set((s) => {
      let panes = s.panes.map((p) => {
        if (p.id !== paneId) return p
        const tabs = p.tabs.filter((t) => t !== path)
        const activePath = p.activePath === path ? (tabs[tabs.length - 1] ?? null) : p.activePath
        return { ...p, tabs, pinned: p.pinned.filter((t) => t !== path), activePath }
      })
      if (panes.length > 1) {
        panes = panes.filter((p) => p.tabs.length > 0 || p.id === s.activePaneId)
      }
      const activePaneId = panes.find((p) => p.id === s.activePaneId) ? s.activePaneId : panes[0].id
      return { panes, activePaneId }
    })
  },

  setActivePane: (paneId) => set({ activePaneId: paneId }),

  activateTab: (paneId, path) => {
    set((s) => ({
      panes: s.panes.map((p) => (p.id === paneId ? { ...p, activePath: path } : p)),
      activePaneId: paneId,
    }))
  },

  togglePin: (paneId, path) => {
    set((s) => ({
      panes: s.panes.map((p) => {
        if (p.id !== paneId) return p
        const pinned = p.pinned.includes(path) ? p.pinned.filter((t) => t !== path) : [...p.pinned, path]
        return { ...p, pinned }
      }),
    }))
  },

  splitPane: () => {
    set((s) => {
      if (s.panes.length >= 2) return s
      const active = s.panes.find((p) => p.id === s.activePaneId)!
      const newPane: Pane = {
        id: crypto.randomUUID(),
        tabs: active.activePath ? [active.activePath] : [],
        pinned: [],
        activePath: active.activePath,
      }
      return { panes: [...s.panes, newPane], activePaneId: newPane.id }
    })
  },

  closePane: (paneId) => {
    set((s) => {
      if (s.panes.length <= 1) return s
      const panes = s.panes.filter((p) => p.id !== paneId)
      const activePaneId = s.activePaneId === paneId ? panes[0].id : s.activePaneId
      return { panes, activePaneId }
    })
  },

  back: () => {
    const s = get()
    if (s.historyIndex <= 0) return
    const idx = s.historyIndex - 1
    const path = s.history[idx]
    set((st) => ({
      historyIndex: idx,
      panes: st.panes.map((p) =>
        p.id === st.activePaneId ? { ...p, tabs: p.tabs.includes(path) ? p.tabs : [...p.tabs, path], activePath: path } : p,
      ),
    }))
  },

  forward: () => {
    const s = get()
    if (s.historyIndex >= s.history.length - 1) return
    const idx = s.historyIndex + 1
    const path = s.history[idx]
    set((st) => ({
      historyIndex: idx,
      panes: st.panes.map((p) =>
        p.id === st.activePaneId ? { ...p, tabs: p.tabs.includes(path) ? p.tabs : [...p.tabs, path], activePath: path } : p,
      ),
    }))
  },

  canGoBack: () => get().historyIndex > 0,
  canGoForward: () => get().historyIndex < get().history.length - 1,

  renamePath: (oldPath, newPath) => {
    set((s) => ({
      panes: s.panes.map((p) => ({
        ...p,
        tabs: p.tabs.map((t) => (t === oldPath ? newPath : t)),
        pinned: p.pinned.map((t) => (t === oldPath ? newPath : t)),
        activePath: p.activePath === oldPath ? newPath : p.activePath,
      })),
      history: s.history.map((h) => (h === oldPath ? newPath : h)),
      recent: s.recent.map((r) => (r === oldPath ? newPath : r)),
    }))
  },

  closeAllForPath: (path) => {
    set((s) => ({
      panes: s.panes.map((p) => ({
        ...p,
        tabs: p.tabs.filter((t) => t !== path && !t.startsWith(path + '/')),
        activePath: p.activePath === path ? null : p.activePath,
      })),
    }))
  },
}))
