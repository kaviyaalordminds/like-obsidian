import { create } from 'zustand'
import type { GraphSnapshotState, NoteFilterCriteria } from '@/types'

export type GraphMode = 'classic' | 'neural' | 'radial' | 'cinematic'
export type ClusterStrategy = 'folder' | 'connected'

interface GraphState {
  mode: GraphMode
  clusterStrategy: ClusterStrategy
  filters: NoteFilterCriteria
  query: string
  selectedNodeId: string | null
  hoveredNodeId: string | null
  pinnedNodeIds: Set<string>
  hiddenNodeIds: Set<string>
  history: string[]
  historyIndex: number
  showHud: boolean
  showMinimap: boolean
  showFilterPanel: boolean
  showInspector: boolean
  presentationMode: boolean
  openPanel: 'path' | 'snapshot' | null

  setMode: (mode: GraphMode) => void
  setClusterStrategy: (s: ClusterStrategy) => void
  setFilters: (patch: Partial<NoteFilterCriteria>) => void
  clearFilters: () => void
  setQuery: (q: string) => void
  selectNode: (id: string | null, opts?: { pushHistory?: boolean }) => void
  setHoveredNode: (id: string | null) => void
  togglePin: (id: string) => void
  toggleHidden: (id: string) => void
  showHiddenNodes: () => void
  back: () => void
  forward: () => void
  canGoBack: () => boolean
  canGoForward: () => boolean
  toggleHud: () => void
  toggleMinimap: () => void
  toggleFilterPanel: () => void
  togglePresentation: () => void
  setOpenPanel: (panel: 'path' | 'snapshot' | null) => void
  toSnapshotState: () => GraphSnapshotState
  loadSnapshotState: (state: GraphSnapshotState) => void
  resetView: () => void
}

export const useGraphStore = create<GraphState>((set, get) => ({
  mode: 'classic',
  clusterStrategy: 'folder',
  filters: {},
  query: '',
  selectedNodeId: null,
  hoveredNodeId: null,
  pinnedNodeIds: new Set(),
  hiddenNodeIds: new Set(),
  history: [],
  historyIndex: -1,
  showHud: true,
  showMinimap: true,
  showFilterPanel: false,
  showInspector: true,
  presentationMode: false,
  openPanel: null,

  setMode: (mode) => set({ mode }),
  setClusterStrategy: (clusterStrategy) => set({ clusterStrategy }),
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  clearFilters: () => set({ filters: {} }),
  setQuery: (query) => set({ query }),

  selectNode: (id, opts) => {
    const pushHistory = opts?.pushHistory ?? true
    set((s) => {
      if (!pushHistory || !id) return { selectedNodeId: id }
      const history = s.history.slice(0, s.historyIndex + 1)
      if (history[history.length - 1] !== id) history.push(id)
      return { selectedNodeId: id, history, historyIndex: history.length - 1 }
    })
  },

  setHoveredNode: (id) => set({ hoveredNodeId: id }),

  togglePin: (id) =>
    set((s) => {
      const next = new Set(s.pinnedNodeIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { pinnedNodeIds: next }
    }),

  toggleHidden: (id) =>
    set((s) => {
      const next = new Set(s.hiddenNodeIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { hiddenNodeIds: next }
    }),

  showHiddenNodes: () => set({ hiddenNodeIds: new Set() }),

  back: () => {
    const s = get()
    if (s.historyIndex <= 0) return
    const idx = s.historyIndex - 1
    set({ historyIndex: idx, selectedNodeId: s.history[idx] })
  },
  forward: () => {
    const s = get()
    if (s.historyIndex >= s.history.length - 1) return
    const idx = s.historyIndex + 1
    set({ historyIndex: idx, selectedNodeId: s.history[idx] })
  },
  canGoBack: () => get().historyIndex > 0,
  canGoForward: () => get().historyIndex < get().history.length - 1,

  toggleHud: () => set((s) => ({ showHud: !s.showHud })),
  toggleMinimap: () => set((s) => ({ showMinimap: !s.showMinimap })),
  toggleFilterPanel: () => set((s) => ({ showFilterPanel: !s.showFilterPanel })),
  togglePresentation: () => set((s) => ({ presentationMode: !s.presentationMode })),
  setOpenPanel: (panel) => set((s) => ({ openPanel: s.openPanel === panel ? null : panel })),

  toSnapshotState: () => {
    const s = get()
    return {
      mode: s.mode,
      filters: s.filters,
      query: s.query,
      selectedNodeId: s.selectedNodeId,
      pinnedNodeIds: [...s.pinnedNodeIds],
      hiddenNodeIds: [...s.hiddenNodeIds],
    }
  },

  loadSnapshotState: (state) => {
    set({
      mode: (state.mode as GraphMode) ?? 'classic',
      filters: state.filters ?? {},
      query: state.query ?? '',
      selectedNodeId: state.selectedNodeId ?? null,
      pinnedNodeIds: new Set(state.pinnedNodeIds ?? []),
      hiddenNodeIds: new Set(state.hiddenNodeIds ?? []),
    })
  },

  resetView: () =>
    set({
      filters: {},
      query: '',
      selectedNodeId: null,
      hiddenNodeIds: new Set(),
    }),
}))
