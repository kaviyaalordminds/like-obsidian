import { useEffect, useState } from 'react'
import { Puzzle } from 'lucide-react'
import { api } from '@/api/client'
import { useVaultStore } from '@/store/vaultStore'
import type { PluginInfo } from '@/types'

export function PluginsTab() {
  const vault = useVaultStore((s) => s.currentVault)
  const [plugins, setPlugins] = useState<PluginInfo[]>([])

  useEffect(() => {
    if (!vault) return
    api.listPlugins(vault.id).then(setPlugins)
  }, [vault])

  const toggle = async (id: string, enabled: boolean) => {
    if (!vault) return
    setPlugins((prev) => prev.map((p) => (p.id === id ? { ...p, enabled } : p)))
    await api.togglePlugin(vault.id, id, enabled)
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--color-text-faint)] mb-3">
        Planned plugins for the plugin-ready architecture. Toggling stores your preference now; the plugin
        implementations themselves ship in a later release.
      </p>
      {plugins.map((p) => (
        <div key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-md border" style={{ borderColor: 'var(--color-border)' }}>
          <Puzzle size={16} className="text-[var(--color-text-faint)]" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{p.name}</div>
            <div className="text-xs text-[var(--color-text-faint)]">{p.description}</div>
          </div>
          <input type="checkbox" checked={p.enabled} onChange={(e) => toggle(p.id, e.target.checked)} />
        </div>
      ))}
    </div>
  )
}
