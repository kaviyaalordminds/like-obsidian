import { useEffect, useRef, useState } from 'react'
import { Bot, Check, Loader2, Send, Sparkles, X } from 'lucide-react'
import { api, streamAIChat, streamAIConfirm, type AIStreamEvent } from '@/api/client'
import { useAIStore } from '@/store/aiStore'
import { useUIStore } from '@/store/uiStore'
import { useVaultStore } from '@/store/vaultStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { applyGraphCommand, isGraphCommandTool } from '@/lib/graphCommands'
import type { AIContextSelection, AIContextPreview } from '@/types'

const CONTEXT_OPTIONS: { id: AIContextSelection['kind']; label: string }[] = [
  { id: 'note', label: 'Current note' },
  { id: 'vault', label: 'Whole vault' },
]

function buildSelection(kind: AIContextSelection['kind'], activePath: string | null): AIContextSelection | null {
  if (kind === 'note') {
    if (!activePath) return null
    return { kind: 'note', paths: [activePath] }
  }
  if (kind === 'vault') return { kind: 'vault' }
  return null
}

export function AIChatPanel() {
  const vault = useVaultStore((s) => s.currentVault)
  const activePane = useWorkspaceStore((s) => s.panes.find((p) => p.id === s.activePaneId))
  const ai = useAIStore()
  const [input, setInput] = useState('')
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [contextKind, setContextKind] = useState<AIContextSelection['kind'] | null>(null)
  const [preview, setPreview] = useState<AIContextPreview | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const settingsOpen = useUIStore((s) => s.settingsOpen)

  useEffect(() => {
    if (!vault) return
    api.getAIConfig(vault.id).then((c) => setConfigured(c.configured))
    // Settings (where the API key is entered) is a separate overlay that
    // doesn't unmount this panel, so re-check whenever it closes — not just
    // on mount — or configuring the key while this tab stays selected would
    // leave the "not configured" state stuck until the user switches tabs
    // away and back.
  }, [vault, settingsOpen])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [ai.messages])

  useEffect(() => {
    if (!vault || !contextKind) {
      setPreview(null)
      return
    }
    const selection = buildSelection(contextKind, activePane?.activePath ?? null)
    if (!selection) {
      setPreview(null)
      return
    }
    api.aiContextPreview(vault.id, selection).then(setPreview)
  }, [vault, contextKind, activePane?.activePath])

  const consumeStream = (fn: (onEvent: (e: AIStreamEvent) => void, signal: AbortSignal) => Promise<void>) => {
    const controller = new AbortController()
    abortRef.current = controller
    ai.setStreaming(true)
    ai.setError(null)
    const messageId = ai.beginAssistantMessage()
    let activeToolMessageId: string | null = null

    fn((event) => {
      if (event.type === 'text_delta') {
        ai.appendText(messageId, event.text)
      } else if (event.type === 'tool_result') {
        ai.addToolCall(messageId, {
          toolName: event.tool_name,
          toolInput: event.tool_input,
          result: event.result,
          status: 'done',
        })
        if (isGraphCommandTool(event.tool_name)) applyGraphCommand(event.tool_name, event.result)
      } else if (event.type === 'pending_confirmation') {
        activeToolMessageId = messageId
        ai.addToolCall(messageId, {
          toolName: event.tool_name,
          toolInput: event.tool_input,
          status: 'pending_confirmation',
          actionId: event.action_id,
          safety: event.safety,
        })
        ai.setPending({ actionId: event.action_id, toolName: event.tool_name, toolInput: event.tool_input, safety: event.safety, messageId })
      } else if (event.type === 'error') {
        ai.setError(event.error)
      }
    }, controller.signal).finally(() => {
      if (!activeToolMessageId) ai.setStreaming(false)
    })
  }

  const send = () => {
    if (!vault || !input.trim() || ai.streaming) return
    const text = input.trim()
    setInput('')
    ai.addUserMessage(text)
    const selection = contextKind ? buildSelection(contextKind, activePane?.activePath ?? null) : null
    consumeStream((onEvent, signal) => streamAIChat(vault.id, ai.conversationId, text, selection, onEvent, signal))
  }

  const respond = (approved: boolean) => {
    if (!vault || !ai.pending) return
    ai.setPending(null)
    consumeStream((onEvent, signal) => streamAIConfirm(vault.id, ai.conversationId, approved, onEvent, signal))
  }

  if (!vault) return null

  if (configured === false) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 p-6 text-center">
        <Sparkles size={22} className="text-[var(--color-text-faint)]" />
        <p className="text-sm text-[var(--color-text-muted)]">No AI provider configured for this vault yet.</p>
        <p className="text-xs text-[var(--color-text-faint)]">Add an Anthropic API key in Settings → AI to start chatting with your vault.</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Bot size={15} className="text-[var(--color-accent)]" /> AI Agent
        </span>
        <button onClick={ai.reset} className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-text)]">
          New chat
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-3">
        {ai.messages.length === 0 && (
          <p className="text-xs text-[var(--color-text-faint)]">
            Ask about your vault — "what's connected to RAG?", "find broken links", "create a note about X".
          </p>
        )}
        {ai.messages
          .filter((m) => m.text || m.toolCalls.length > 0)
          .map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'text-right' : ''}>
            <div
              className="inline-block max-w-[90%] text-left rounded-lg px-3 py-2 text-sm whitespace-pre-wrap"
              style={{
                background: m.role === 'user' ? 'var(--color-accent-soft)' : 'var(--color-bg-inset)',
                color: m.role === 'user' ? 'var(--color-accent)' : 'var(--color-text)',
              }}
            >
              {m.text}
              {m.toolCalls.map((tc, i) => (
                <ToolCallChip key={i} record={tc} onApprove={() => respond(true)} onReject={() => respond(false)} />
              ))}
            </div>
          </div>
        ))}
        {ai.streaming && !ai.pending && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-faint)]">
            <Loader2 size={12} className="animate-spin" /> thinking…
          </div>
        )}
        {ai.error && <div className="text-xs text-[var(--color-danger)]">{ai.error}</div>}
      </div>

      <div className="border-t p-2" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-1 mb-1.5 flex-wrap">
          {CONTEXT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setContextKind(contextKind === opt.id ? null : opt.id)}
              className="px-2 py-0.5 rounded text-xs border"
              style={{
                borderColor: contextKind === opt.id ? 'var(--color-accent)' : 'var(--color-border)',
                color: contextKind === opt.id ? 'var(--color-accent)' : 'var(--color-text-faint)',
              }}
            >
              {opt.label}
            </button>
          ))}
          {preview && (
            <span className="text-xs text-[var(--color-text-faint)]">
              {preview.note_count} note(s) · {preview.word_count} words
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Ask your vault…"
            disabled={ai.streaming}
            className="flex-1 settings-input text-sm"
          />
          <button
            onClick={send}
            disabled={ai.streaming || !input.trim()}
            className="p-2 rounded-md text-white disabled:opacity-40"
            style={{ background: 'var(--color-accent)' }}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

function ToolCallChip({
  record,
  onApprove,
  onReject,
}: {
  record: { toolName: string; toolInput: Record<string, unknown>; status: string; safety?: string }
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <div className="mt-1.5 px-2 py-1.5 rounded border text-xs" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
      <div className="font-mono text-[var(--color-accent)]">{record.toolName}</div>
      <div className="text-[var(--color-text-faint)] truncate">{JSON.stringify(record.toolInput)}</div>
      {record.status === 'pending_confirmation' && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="text-[var(--color-text-muted)]">
            {record.safety === 'destructive' ? 'This cannot be undone.' : 'Confirm this action?'}
          </span>
          <button onClick={onApprove} className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded text-white" style={{ background: 'var(--color-accent)' }}>
            <Check size={11} /> Approve
          </button>
          <button onClick={onReject} className="flex items-center gap-1 px-2 py-0.5 rounded border" style={{ borderColor: 'var(--color-border)' }}>
            <X size={11} /> Reject
          </button>
        </div>
      )}
    </div>
  )
}
