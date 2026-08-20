import { create } from 'zustand'
import { api, ApiError } from '@/api/client'
import type { Note, SaveStatus } from '@/types'
import { debounce } from '@/lib/debounce'

interface NoteEntry {
  note: Note
  content: string
  dirty: boolean
  status: SaveStatus
  loading: boolean
  // Set when a save (or an external-change notification while dirty) finds
  // the file on disk no longer matches what this entry was last read from —
  // another tab, Obsidian itself, or a sync client changed it. Never
  // resolved automatically (Part 56): the user picks Keep Current, Use
  // External, or Merge.
  conflict: Note | null
}

interface NoteState {
  entries: Record<string, NoteEntry>
  loadNote: (vaultId: string, path: string) => Promise<void>
  updateContent: (vaultId: string, path: string, content: string) => void
  saveNow: (vaultId: string, path: string) => Promise<void>
  evict: (path: string) => void
  renamePath: (oldPath: string, newPath: string, note: Note) => void
  syncFromExternal: (vaultId: string, path: string) => Promise<void>
  resolveConflictKeepCurrent: (vaultId: string, path: string) => Promise<void>
  resolveConflictUseExternal: (path: string) => void
  resolveConflictMerge: (path: string) => void
}

const savers = new Map<string, ReturnType<typeof debounce>>()

async function doSave(vaultId: string, path: string, set: (fn: (s: NoteState) => Partial<NoteState>) => void, get: () => NoteState) {
  const entry = get().entries[path]
  if (!entry) return
  set((s) => ({ entries: { ...s.entries, [path]: { ...s.entries[path], status: 'saving' } } }))
  try {
    const updated = await api.saveNote(vaultId, path, entry.content, entry.note?.modified_at)
    set((s) => {
      const current = s.entries[path]
      if (!current) return {}
      return {
        entries: {
          ...s.entries,
          [path]: { ...current, note: updated, dirty: current.content !== updated.content ? current.dirty : false, status: 'saved', conflict: null },
        },
      }
    })
  } catch (e) {
    if (e instanceof ApiError && e.status === 409 && e.detail && typeof e.detail === 'object') {
      set((s) => ({ entries: { ...s.entries, [path]: { ...s.entries[path], status: 'conflict', conflict: e.detail as Note } } }))
    } else {
      set((s) => ({ entries: { ...s.entries, [path]: { ...s.entries[path], status: 'error' } } }))
    }
  }
}

function getSaver(vaultId: string, path: string, set: (fn: (s: NoteState) => Partial<NoteState>) => void, get: () => NoteState) {
  const key = `${vaultId}:${path}`
  let saver = savers.get(key)
  if (!saver) {
    saver = debounce(() => {
      // Never auto-retry into an unresolved conflict — that would keep
      // re-fetching the same "someone else changed this" notice on every
      // keystroke instead of waiting for the user's explicit choice.
      if (get().entries[path]?.status === 'conflict') return
      doSave(vaultId, path, set, get)
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
      entries: {
        ...s.entries,
        [path]: existing ?? { note: null as unknown as Note, content: '', dirty: false, status: 'idle', loading: true, conflict: null },
      },
    }))
    const note = await api.getNote(vaultId, path)
    set((s) => ({
      entries: { ...s.entries, [path]: { note, content: note.content, dirty: false, status: 'idle', loading: false, conflict: null } },
    }))
  },

  updateContent: (vaultId, path, content) => {
    set((s) => {
      const entry = s.entries[path]
      if (!entry) return {}
      return { entries: { ...s.entries, [path]: { ...entry, content, dirty: true, status: entry.status === 'conflict' ? 'conflict' : 'saving' } } }
    })
    getSaver(vaultId, path, set, get)()
  },

  saveNow: async (vaultId, path) => {
    if (get().entries[path]?.status === 'conflict') return
    await doSave(vaultId, path, set, get)
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

  // Pulls in an external edit (another tab, the AI agent, a second device)
  // to a note that's already open here — but only while it has no unsaved
  // local edits, so a background sync can never clobber in-progress typing.
  // If it IS dirty, this is a real conflict: surface it now rather than
  // waiting for the next autosave attempt to discover it.
  syncFromExternal: async (vaultId, path) => {
    const entry = get().entries[path]
    if (!entry) return
    const note = await api.getNote(vaultId, path)
    set((s) => {
      const current = s.entries[path]
      if (!current) return {}
      if (current.dirty) {
        return { entries: { ...s.entries, [path]: { ...current, status: 'conflict', conflict: note } } }
      }
      if (current.status === 'conflict') return {}
      return { entries: { ...s.entries, [path]: { ...current, note, content: note.content, status: 'saved' } } }
    })
  },

  // Keep Current: force-save the local content, overwriting the external
  // change — an explicit choice, never the default.
  resolveConflictKeepCurrent: async (vaultId, path) => {
    const entry = get().entries[path]
    if (!entry) return
    set((s) => ({ entries: { ...s.entries, [path]: { ...s.entries[path], status: 'saving' } } }))
    try {
      const updated = await api.saveNote(vaultId, path, entry.content)
      set((s) => ({ entries: { ...s.entries, [path]: { ...s.entries[path], note: updated, dirty: false, status: 'saved', conflict: null } } }))
    } catch {
      set((s) => ({ entries: { ...s.entries, [path]: { ...s.entries[path], status: 'error' } } }))
    }
  },

  // Use External: discard local edits, adopt the on-disk version.
  resolveConflictUseExternal: (path) => {
    set((s) => {
      const entry = s.entries[path]
      if (!entry || !entry.conflict) return {}
      const note = entry.conflict
      return { entries: { ...s.entries, [path]: { ...entry, note, content: note.content, dirty: false, status: 'saved', conflict: null } } }
    })
  },

  // Merge: neither version wins automatically — both are placed in the
  // editor, clearly marked, for the user to reconcile by hand before the
  // next save.
  resolveConflictMerge: (path) => {
    set((s) => {
      const entry = s.entries[path]
      if (!entry || !entry.conflict) return {}
      const merged =
        `${entry.content}\n\n<!-- ===== External version (from disk) — resolve and remove this block ===== -->\n\n` +
        `${entry.conflict.content}\n\n<!-- ===== End external version ===== -->\n`
      return {
        entries: {
          ...s.entries,
          [path]: { ...entry, note: entry.conflict, content: merged, dirty: true, status: 'saving', conflict: null },
        },
      }
    })
  },
}))
