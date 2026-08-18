import { create } from 'zustand'
import { api } from '@/api/client'

export type Theme = 'light' | 'dark' | 'system'

export interface EditorSettings {
  fontSize: number
  tabSize: number
  lineWidth: number // 0 = full width
  wordWrap: boolean
  lineNumbers: boolean
}

export interface GraphSettings {
  nodeSize: number
  linkDistance: number
  showLabels: boolean
  showArrows: boolean
  animate: boolean
  depth: number
  showOrphans: boolean
  showUnresolved: boolean
}

export interface DailyNoteSettings {
  folder: string
  dateFormat: string
  templatePath: string
}

interface SettingsState {
  theme: Theme
  editor: EditorSettings
  graph: GraphSettings
  dailyNotes: DailyNoteSettings
  loaded: boolean

  setTheme: (theme: Theme) => void
  updateEditor: (patch: Partial<EditorSettings>) => void
  updateGraph: (patch: Partial<GraphSettings>) => void
  updateDailyNotes: (patch: Partial<DailyNoteSettings>) => void
  loadFromVault: (vaultId: string) => Promise<void>
  persist: (vaultId: string) => void
}

const STORAGE_KEY = 'like-obsidian:settings'

const defaults = {
  theme: 'system' as Theme,
  editor: { fontSize: 15, tabSize: 2, lineWidth: 700, wordWrap: true, lineNumbers: false } as EditorSettings,
  graph: {
    nodeSize: 6,
    linkDistance: 80,
    showLabels: true,
    showArrows: false,
    animate: true,
    depth: 1,
    showOrphans: true,
    showUnresolved: true,
  } as GraphSettings,
  dailyNotes: { folder: 'Daily Notes', dateFormat: '%Y-%m-%d', templatePath: '' } as DailyNoteSettings,
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw)
    return {
      theme: parsed.theme ?? defaults.theme,
      editor: { ...defaults.editor, ...parsed.editor },
      graph: { ...defaults.graph, ...parsed.graph },
      dailyNotes: { ...defaults.dailyNotes, ...parsed.dailyNotes },
    }
  } catch {
    return defaults
  }
}

function applyThemeToDom(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

let persistTimer: ReturnType<typeof setTimeout> | null = null

export const useSettingsStore = create<SettingsState>((set, get) => {
  const initial = loadLocal()
  applyThemeToDom(initial.theme)

  return {
    ...initial,
    loaded: false,

    setTheme: (theme) => {
      applyThemeToDom(theme)
      set({ theme })
      saveLocal(get())
    },
    updateEditor: (patch) => {
      set((s) => ({ editor: { ...s.editor, ...patch } }))
      saveLocal(get())
    },
    updateGraph: (patch) => {
      set((s) => ({ graph: { ...s.graph, ...patch } }))
      saveLocal(get())
    },
    updateDailyNotes: (patch) => {
      set((s) => ({ dailyNotes: { ...s.dailyNotes, ...patch } }))
      saveLocal(get())
    },

    loadFromVault: async (vaultId: string) => {
      try {
        const res = await api.getSettings(vaultId)
        if (res.data && Object.keys(res.data).length > 0) {
          const merged = {
            theme: (res.data.theme as Theme) ?? get().theme,
            editor: { ...get().editor, ...(res.data.editor as object) },
            graph: { ...get().graph, ...(res.data.graph as object) },
            dailyNotes: { ...get().dailyNotes, ...(res.data.dailyNotes as object) },
          }
          applyThemeToDom(merged.theme)
          set({ ...merged, loaded: true })
          saveLocal(get())
        } else {
          set({ loaded: true })
        }
      } catch {
        set({ loaded: true })
      }
    },

    persist: (vaultId: string) => {
      if (persistTimer) clearTimeout(persistTimer)
      persistTimer = setTimeout(() => {
        const s = get()
        api.updateSettings(vaultId, { theme: s.theme, editor: s.editor, graph: s.graph, dailyNotes: s.dailyNotes })
      }, 500)
    },
  }
})

function saveLocal(s: SettingsState) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ theme: s.theme, editor: s.editor, graph: s.graph, dailyNotes: s.dailyNotes }),
  )
}
