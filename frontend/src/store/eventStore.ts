import { create } from 'zustand'

// Version counters bumped by useVaultEvents (Part 55) as real-time SSE
// events arrive from the backend event bus. Components that need to react
// to changes they didn't cause themselves (another tab, the AI agent, a
// second device) add these as effect dependencies instead of polling.
interface EventState {
  graphVersion: number
  aiActivityVersion: number
  bumpGraph: () => void
  bumpAiActivity: () => void
}

export const useEventStore = create<EventState>((set) => ({
  graphVersion: 0,
  aiActivityVersion: 0,
  bumpGraph: () => set((s) => ({ graphVersion: s.graphVersion + 1 })),
  bumpAiActivity: () => set((s) => ({ aiActivityVersion: s.aiActivityVersion + 1 })),
}))
