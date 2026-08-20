import { useEffect, useState } from 'react'
import { X, Plus, Trash2, FolderInput } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useVaultStore } from '@/store/vaultStore'
import { ApiError } from '@/api/client'

export function VaultSwitcherModal() {
  const open = useUIStore((s) => s.vaultSwitcherOpen)
  const setOpen = useUIStore((s) => s.setVaultSwitcherOpen)
  const vaults = useVaultStore((s) => s.vaults)
  const currentVault = useVaultStore((s) => s.currentVault)
  const loadVaults = useVaultStore((s) => s.loadVaults)
  const openVault = useVaultStore((s) => s.openVault)
  const createVault = useVaultStore((s) => s.createVault)
  const connectVault = useVaultStore((s) => s.connectVault)
  const forgetVault = useVaultStore((s) => s.forgetVault)
  const [newName, setNewName] = useState('')
  const [connectPath, setConnectPath] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)

  useEffect(() => {
    if (open) loadVaults()
  }, [open, loadVaults])

  if (!open) return null

  const handleCreate = async () => {
    if (!newName.trim()) return
    const vault = await createVault(newName.trim())
    setNewName('')
    await openVault(vault)
    setOpen(false)
  }

  const handleConnect = async () => {
    if (!connectPath.trim() || connecting) return
    setConnecting(true)
    setConnectError(null)
    try {
      const vault = await connectVault(connectPath.trim())
      setConnectPath('')
      await openVault(vault)
      setOpen(false)
    } catch (e) {
      setConnectError(e instanceof ApiError ? e.message : 'Could not connect that folder.')
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setOpen(false)}>
      <div className="fixed inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-md rounded-xl border p-5"
        style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-glow)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Switch vault</h3>
          <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-[var(--color-bg-inset)]">
            <X size={14} />
          </button>
        </div>

        <div className="space-y-1 max-h-64 overflow-auto mb-4">
          {vaults.map((v) => (
            <div
              key={v.id}
              className="flex items-center gap-2 px-3 py-2 rounded-md group"
              style={{ background: currentVault?.id === v.id ? 'var(--color-accent-soft)' : 'transparent' }}
            >
              <button
                className="flex-1 flex items-center gap-2 text-left text-sm"
                onClick={async () => {
                  await openVault(v)
                  setOpen(false)
                }}
              >
                <span>{v.icon}</span>
                <span className="truncate">{v.name}</span>
                {v.external_path && (
                  <span
                    title={v.external_path}
                    className="shrink-0 flex items-center gap-1 text-xs px-1.5 py-0.5 rounded text-[var(--color-text-faint)]"
                    style={{ background: 'var(--color-bg-inset)' }}
                  >
                    <FolderInput size={10} /> {v.is_obsidian_vault ? 'Obsidian vault' : 'connected folder'}
                  </span>
                )}
              </button>
              <button
                title="Remove from list (keeps files on disk)"
                onClick={() => {
                  if (confirm(`Remove "${v.name}" from the vault list? Files on disk are kept.`)) forgetVault(v.id)
                }}
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--color-bg-inset)] text-[var(--color-danger)]"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {vaults.length === 0 && <div className="text-xs text-[var(--color-text-faint)] px-3 py-2">No vaults yet.</div>}
        </div>

        <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="New vault name"
            className="flex-1 px-2.5 py-1.5 rounded-md border bg-transparent text-sm outline-none"
            style={{ borderColor: 'var(--color-border)' }}
          />
          <button
            onClick={handleCreate}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm text-white"
            style={{ background: 'var(--color-accent)' }}
          >
            <Plus size={14} /> Create
          </button>
        </div>

        <div className="pt-3 mt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-faint)] mb-1.5">
            <FolderInput size={12} /> Connect an existing folder (e.g. an Obsidian vault) — read and written in place, nothing is copied.
          </div>
          <div className="flex items-center gap-2">
            <input
              value={connectPath}
              onChange={(e) => setConnectPath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
              placeholder="/absolute/path/to/vault"
              className="flex-1 px-2.5 py-1.5 rounded-md border bg-transparent text-sm outline-none font-mono"
              style={{ borderColor: 'var(--color-border)' }}
            />
            <button
              onClick={handleConnect}
              disabled={connecting || !connectPath.trim()}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm border disabled:opacity-40"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <FolderInput size={14} /> {connecting ? 'Connecting…' : 'Connect'}
            </button>
          </div>
          {connectError && <p className="text-xs text-[var(--color-danger)] mt-1.5">{connectError}</p>}
        </div>
      </div>
    </div>
  )
}
