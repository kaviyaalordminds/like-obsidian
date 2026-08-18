import { create } from 'zustand'
import { api } from '@/api/client'
import type { Note, SaveStatus } from '@/types'
import { debounce } from '@/lib/debounce'

interface NoteEntry {
  note: Note
  content: string
  dirty: boolean
  status: SaveStatus
  loading: boolean
}

interface NoteState {
  entries: Record<string, NoteEntry>
  loadNote: (vaultId: string, path: string) => Promise<void>
  updateContent: (vaultId: string, path: string, content: string) => void
  saveNow: (vaultId: string, path: string) => Promise<void>
  evict: (path: string) => void
  renamePath: (oldPath: string, newPath: string, note: Note) => void
}

const savers = new Map<string, ReturnType<typeof debounce>>()

function getSaver(vaultId: string, path: string, set: (fn: (s: NoteState) => Partial<NoteState>) => void, get: () => NoteState) {
  const key = `${vaultId}:${path}`
  let saver = savers.get(key)
  if (!saver) {
    saver = debounce(async () => {
      const entry = get().entries[path]
      if (!entry) return
      set((s) => ({ entries: { ...s.entries, [path]: { ...s.entries[path], status: 'saving' } } }))
      try {
        const updated = await api.saveNote(vaultId, path, entry.content)
        set((s) => {
          const current = s.entries[path]
          if (!current) return {}
          return {
            entries: {
              ...s.entries,
              [path]: { ...current, note: updated, dirty: current.content !== updated.content ? current.dirty : false, status: 'saved' },
            },
          }
        })
      } catch {
        set((s) => ({ entries: { ...s.entries, [path]: { ...s.entries[path], status: 'error' } } }))
      }
    }, 800)
    savers.set(key, saver)
  }
  return saver
}

export const useNoteStore = create<NoteState>((set, get) => ({
  entries: {},

  loadNote: async (vaultId, path) => {
    const existing = get().entries[path]
    if (existing && !existing.loading) return
    set((s) => ({
      entries: { ...s.entries, [path]: existing ?? { note: null as unknown as Note, content: '', dirty: false, status: 'idle', loading: true } },
    }))
    const note = await api.getNote(vaultId, path)
    set((s) => ({
      entries: { ...s.entries, [path]: { note, content: note.content, dirty: false, status: 'idle', loading: false } },
    }))
  },

  updateContent: (vaultId, path, content) => {
    set((s) => {
      const entry = s.entries[path]
      if (!entry) return {}
      return { entries: { ...s.entries, [path]: { ...entry, content, dirty: true, status: 'saving' } } }
    })
    getSaver(vaultId, path, set, get)()
  },

  saveNow: async (vaultId, path) => {
    const entry = get().entries[path]
    if (!entry) return
    set((s) => ({ entries: { ...s.entries, [path]: { ...s.entries[path], status: 'saving' } } }))
    try {
      const updated = await api.saveNote(vaultId, path, entry.content)
      set((s) => ({ entries: { ...s.entries, [path]: { ...s.entries[path], note: updated, dirty: false, status: 'saved' } } }))
    } catch {
      set((s) => ({ entries: { ...s.entries, [path]: { ...s.entries[path], status: 'error' } } }))
    }
  },

  evict: (path) => {
    set((s) => {
      const { [path]: _drop, ...rest } = s.entries
      return { entries: rest }
    })
  },

  renamePath: (oldPath, newPath, note) => {
    set((s) => {
      const entry = s.entries[oldPath]
      const { [oldPath]: _drop, ...rest } = s.entries
      return {
        entries: entry ? { ...rest, [newPath]: { ...entry, note } } : rest,
      }
    })
  },
}))
