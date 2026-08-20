import { useEffect, useState } from 'react'
import { Cable, CheckCircle2, Key, XCircle } from 'lucide-react'
import { api } from '@/api/client'
import { useVaultStore } from '@/store/vaultStore'
import type { ObsidianConnectionConfig, ObsidianTestResult } from '@/types'

export function ObsidianTab() {
  const vault = useVaultStore((s) => s.currentVault)
  const [config, setConfig] = useState<ObsidianConnectionConfig | null>(null)
  const [host, setHost] = useState('')
  const [port, setPort] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<ObsidianTestResult | null>(null)

  useEffect(() => {
    if (!vault) return
    api.getObsidianRestConfig(vault.id).then((c) => {
      setConfig(c)
      setHost(c.host)
      setPort(String(c.port))
    })
  }, [vault])

  const save = async () => {
    if (!vault) return
    const patch: Parameters<typeof api.setObsidianRestConfig>[1] = {}
    if (host.trim()) patch.host = host.trim()
    const portNum = Number(port)
    if (Number.isFinite(portNum) && portNum > 0) patch.port = portNum
    if (apiKey.trim()) patch.api_key = apiKey.trim()
    const updated = await api.setObsidianRestConfig(vault.id, patch)
    setConfig(updated)
    setApiKey('')
    setResult(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const testConnection = async () => {
    if (!vault) return
    setTesting(true)
    setResult(null)
    try {
      const r = await api.testObsidianRestConnection(vault.id)
      setResult(r)
    } finally {
      setTesting(false)
    }
  }

  if (!config) return null

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-[var(--color-text-faint)] mb-3">
          Connect this vault to a running Obsidian instance via the Local REST API community plugin — an alternative
          to connecting the vault's folder directly. Requires the plugin installed and enabled in Obsidian, with its
          API key pasted below. Not required for normal use: connecting a vault folder directly (Vault tab) already
          gives full two-way access.
        </p>

        <div className="flex items-center gap-2 mb-2">
          <Cable size={14} className="text-[var(--color-text-faint)]" />
          <span className="text-sm font-medium">Connection</span>
          {config.configured && (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}>
              Configured
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5 mb-1.5">
          <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="127.0.0.1" className="settings-input text-xs" />
          <input
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="27124"
            inputMode="numeric"
            className="settings-input text-xs"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Key size={12} className="text-[var(--color-text-faint)] shrink-0" />
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={config.configured ? 'Replace existing key…' : 'API key from the plugin settings'}
            className="settings-input flex-1 text-xs"
          />
          <button
            onClick={save}
            className="px-3 py-1.5 rounded-md text-xs text-white shrink-0"
            style={{ background: 'var(--color-accent)' }}
          >
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      <div>
        <button
          onClick={testConnection}
          disabled={testing || !config.configured}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border disabled:opacity-40"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <Cable size={12} /> {testing ? 'Testing…' : 'Test connection'}
        </button>
        {result && (
          <div
            className="flex items-center gap-1.5 mt-2 text-xs"
            style={{ color: result.ok ? 'var(--color-accent)' : 'var(--color-danger)' }}
          >
            {result.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
            {result.ok ? `Connected — ${result.service || 'Obsidian'} responded.` : result.error}
          </div>
        )}
      </div>
    </div>
  )
}
