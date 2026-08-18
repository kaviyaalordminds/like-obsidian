import { useEffect, useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useVaultStore } from '@/store/vaultStore'

export function VaultSwitcherModal() {
  const open = useUIStore((s) => s.vaultSwitcherOpen)
  const setOpen = useUIStore((s) => s.setVaultSwitcherOpen)
  const vaults = useVaultStore((s) => s.vaults)
  const currentVault = useVaultStore((s) => s.currentVault)
  const loadVaults = useVaultStore((s) => s.loadVaults)
  const openVault = useVaultStore((s) => s.openVault)
  const createVault = useVaultStore((s) => s.createVault)
  const forgetVault = useVaultStore((s) => s.forgetVault)
  const [newName, setNewName] = useState('')

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
      </div>
    </div>
  )
}
