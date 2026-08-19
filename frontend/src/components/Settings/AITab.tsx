import { useEffect, useState } from 'react'
import { Bot, History, Key, ShieldCheck } from 'lucide-react'
import { api } from '@/api/client'
import { useVaultStore } from '@/store/vaultStore'
import { useEventStore } from '@/store/eventStore'
import type { AIAction, AIConfig } from '@/types'

export function AITab() {
  const vault = useVaultStore((s) => s.currentVault)
  const [config, setConfig] = useState<AIConfig | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [actions, setActions] = useState<AIAction[]>([])
  const [showLog, setShowLog] = useState(false)
  const aiActivityVersion = useEventStore((s) => s.aiActivityVersion)

  useEffect(() => {
    if (!vault) return
    api.getAIConfig(vault.id).then(setConfig)
  }, [vault])

  useEffect(() => {
    if (!vault || !showLog) return
    api.listAIActions(vault.id).then(setActions)
    // aiActivityVersion ticks on every AI_ACTION_STARTED/COMPLETED SSE event
    // (Part 55) so an open log stays live while the agent is working,
    // instead of only reflecting whatever had already happened when it was
    // first expanded.
  }, [vault, showLog, aiActivityVersion])

  const saveKey = async () => {
    if (!vault || !apiKey.trim()) return
    const updated = await api.setAIConfig(vault.id, { api_key: apiKey.trim() })
    setConfig(updated)
    setApiKey('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const updateAutoApprove = async (v: boolean) => {
    if (!vault) return
    const updated = await api.setAIConfig(vault.id, { auto_approve_safe: v })
    setConfig(updated)
  }

  const updateModel = async (model: string) => {
    if (!vault) return
    const updated = await api.setAIConfig(vault.id, { model })
    setConfig(updated)
  }

  if (!config) return null

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-[var(--color-text-faint)] mb-3">
          The AI Agent is entirely optional — every core feature (notes, search, graph, tags, backlinks) works
          without it. Nothing in your vault is sent anywhere unless you explicitly ask the agent something, and it
          never modifies a note without your confirmation.
        </p>

        <div className="flex items-center gap-2 mb-2">
          <Key size={14} className="text-[var(--color-text-faint)]" />
          <span className="text-sm font-medium">Anthropic API key</span>
          {config.configured && (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}>
              Configured
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={config.configured ? 'Replace existing key…' : 'sk-ant-…'}
            className="settings-input flex-1 text-xs"
          />
          <button
            onClick={saveKey}
            disabled={!apiKey.trim()}
            className="px-3 py-1.5 rounded-md text-xs text-white disabled:opacity-40"
            style={{ background: 'var(--color-accent)' }}
          >
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      <div>
        <label className="flex items-center justify-between py-1 text-sm">
          <span>Model</span>
          <select value={config.model} onChange={(e) => updateModel(e.target.value)} className="settings-select text-xs">
            <option value="claude-opus-5">Claude Opus 5</option>
            <option value="claude-sonnet-5">Claude Sonnet 5</option>
            <option value="claude-haiku-4-5">Claude Haiku 4.5</option>
          </select>
        </label>
        <label className="flex items-center justify-between py-1 text-sm">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-[var(--color-text-faint)]" /> Auto-approve safe actions
          </span>
          <input type="checkbox" checked={config.auto_approve_safe} onChange={(e) => updateAutoApprove(e.target.checked)} />
        </label>
        <p className="text-xs text-[var(--color-text-faint)] mt-1">
          Create/update/rename/move run without asking when this is on. Delete always asks, no matter what.
        </p>
      </div>

      <div>
        <button
          onClick={() => setShowLog((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-medium mb-2"
        >
          <History size={14} /> AI Activity {showLog ? '▾' : '▸'}
        </button>
        {showLog && (
          <div className="space-y-1 max-h-48 overflow-auto">
            {actions.length === 0 && <div className="text-xs text-[var(--color-text-faint)]">No AI activity yet.</div>}
            {actions.map((a) => (
              <div key={a.id} className="flex items-center gap-2 px-2 py-1 rounded text-xs" style={{ background: 'var(--color-bg-inset)' }}>
                <Bot size={11} className="text-[var(--color-text-faint)] shrink-0" />
                <span className="font-mono text-[var(--color-accent)] shrink-0">{a.tool_name}</span>
                <span
                  className="shrink-0 px-1 rounded"
                  style={{
                    color:
                      a.status === 'executed' ? 'var(--color-accent)' : a.status === 'error' ? 'var(--color-danger)' : 'var(--color-text-faint)',
                  }}
                >
                  {a.status}
                </span>
                <span className="text-[var(--color-text-faint)] truncate">{new Date(a.created_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
