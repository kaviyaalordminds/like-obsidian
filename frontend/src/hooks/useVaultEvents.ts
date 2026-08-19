import { useEffect } from 'react'
import { useVaultStore } from '@/store/vaultStore'
import { useNoteStore } from '@/store/noteStore'
import { useEventStore } from '@/store/eventStore'

const API_BASE = '/api'

// Real-time sync (Part 55): one SSE connection per open vault, pushed from
// the backend event bus — never polled. Structural changes (new/deleted/
// renamed/moved notes, or anything the AI agent does) refresh the file
// tree and graph directly instead of waiting for the user to notice.
export function useVaultEvents(vaultId: string | undefined) {
  useEffect(() => {
    if (!vaultId) return

    const source = new EventSource(`${API_BASE}/vaults/${vaultId}/events`)
    const refreshTree = () => useVaultStore.getState().refreshTree()

    source.addEventListener('NOTE_CREATED', refreshTree)
    source.addEventListener('NOTE_DELETED', refreshTree)
    source.addEventListener('NOTE_RENAMED', refreshTree)
    source.addEventListener('NOTE_MOVED', refreshTree)
    source.addEventListener('VAULT_CHANGED', refreshTree)

    source.addEventListener('NOTE_UPDATED', (e: MessageEvent) => {
      try {
        const { path } = JSON.parse(e.data) as { path: string }
        useNoteStore.getState().syncFromExternal(vaultId, path)
      } catch {
        // malformed payload — ignore this one event, the connection stays open
      }
    })

    source.addEventListener('GRAPH_UPDATED', () => useEventStore.getState().bumpGraph())
    source.addEventListener('AI_ACTION_STARTED', () => useEventStore.getState().bumpAiActivity())
    source.addEventListener('AI_ACTION_COMPLETED', () => useEventStore.getState().bumpAiActivity())

    return () => source.close()
  }, [vaultId])
}
