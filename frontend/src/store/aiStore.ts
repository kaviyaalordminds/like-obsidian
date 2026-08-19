import { create } from 'zustand'
import type { AIChatMessage, AIContextSelection, AIToolCallRecord } from '@/types'

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

interface PendingConfirmation {
  actionId: string
  toolName: string
  toolInput: Record<string, unknown>
  safety: string
  messageId: string
}

interface AIState {
  conversationId: string
  messages: AIChatMessage[]
  streaming: boolean
  pending: PendingConfirmation | null
  contextSelection: AIContextSelection | null
  error: string | null

  reset: () => void
  setContextSelection: (s: AIContextSelection | null) => void
  addUserMessage: (text: string) => string
  beginAssistantMessage: () => string
  appendText: (messageId: string, text: string) => void
  addToolCall: (messageId: string, record: AIToolCallRecord) => void
  updateLastToolCall: (messageId: string, patch: Partial<AIToolCallRecord>) => void
  setPending: (p: PendingConfirmation | null) => void
  setStreaming: (v: boolean) => void
  setError: (e: string | null) => void
}

export const useAIStore = create<AIState>((set) => ({
  conversationId: uid(),
  messages: [],
  streaming: false,
  pending: null,
  contextSelection: null,
  error: null,

  reset: () => set({ conversationId: uid(), messages: [], streaming: false, pending: null, error: null }),
  setContextSelection: (s) => set({ contextSelection: s }),

  addUserMessage: (text) => {
    const id = uid()
    set((s) => ({ messages: [...s.messages, { id, role: 'user', text, toolCalls: [] }] }))
    return id
  },

  beginAssistantMessage: () => {
    const id = uid()
    set((s) => ({ messages: [...s.messages, { id, role: 'assistant', text: '', toolCalls: [] }] }))
    return id
  },

  appendText: (messageId, text) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === messageId ? { ...m, text: m.text + text } : m)),
    })),

  addToolCall: (messageId, record) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === messageId ? { ...m, toolCalls: [...m.toolCalls, record] } : m)),
    })),

  updateLastToolCall: (messageId, patch) =>
    set((s) => ({
      messages: s.messages.map((m) => {
        if (m.id !== messageId || m.toolCalls.length === 0) return m
        const toolCalls = [...m.toolCalls]
        toolCalls[toolCalls.length - 1] = { ...toolCalls[toolCalls.length - 1], ...patch }
        return { ...m, toolCalls }
      }),
    })),

  setPending: (p) => set({ pending: p }),
  setStreaming: (v) => set({ streaming: v }),
  setError: (e) => set({ error: e }),
}))

export function currentConversationId(): string {
  return useAIStore.getState().conversationId
}
