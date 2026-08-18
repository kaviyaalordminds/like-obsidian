import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useVaultStore } from '@/store/vaultStore'
import { TemplatesTab } from './TemplatesTab'
import { PluginsTab } from './PluginsTab'
import { HotkeysTab } from './HotkeysTab'

type Tab = 'appearance' | 'editor' | 'graph' | 'daily-notes' | 'templates' | 'hotkeys' | 'plugins' | 'vault'

const tabs: { id: Tab; label: string }[] = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'editor', label: 'Editor' },
  { id: 'graph', label: 'Graph' },
  { id: 'daily-notes', label: 'Daily Notes' },
  { id: 'templates', label: 'Templates' },
  { id: 'hotkeys', label: 'Hotkeys' },
  { id: 'plugins', label: 'Plugins' },
  { id: 'vault', label: 'Vault' },
]

export function SettingsModal() {
  const open = useUIStore((s) => s.settingsOpen)
  const setOpen = useUIStore((s) => s.setSettingsOpen)
  const [tab, setTab] = useState<Tab>('appearance')
  const settings = useSettingsStore()
  const vault = useVaultStore((s) => s.currentVault)

  useEffect(() => {
    if (open && vault) settings.loadFromVault(vault.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (vault) settings.persist(vault.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.theme, settings.editor, settings.graph, settings.dailyNotes])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setOpen(false)}>
      <div className="fixed inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-2xl h-[560px] rounded-xl border flex overflow-hidden"
        style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-glow)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-44 border-r p-2 shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="w-full text-left px-3 py-1.5 rounded-md text-sm mb-0.5"
              style={{
                background: tab === t.id ? 'var(--color-accent-soft)' : 'transparent',
                color: tab === t.id ? 'var(--color-accent)' : 'var(--color-text-muted)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <h3 className="text-sm font-semibold">Settings</h3>
            <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-[var(--color-bg-inset)]">
              <X size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-5">
            {tab === 'appearance' && (
              <div className="space-y-4">
                <Field label="Theme">
                  <select
                    value={settings.theme}
                    onChange={(e) => settings.setTheme(e.target.value as 'light' | 'dark' | 'system')}
                    className="settings-select"
                  >
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </Field>
              </div>
            )}

            {tab === 'editor' && (
              <div className="space-y-4">
                <Field label="Font size">
                  <input
                    type="number"
                    min={10}
                    max={28}
                    value={settings.editor.fontSize}
                    onChange={(e) => settings.updateEditor({ fontSize: Number(e.target.value) })}
                    className="settings-input w-20"
                  />
                </Field>
                <Field label="Tab size">
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={settings.editor.tabSize}
                    onChange={(e) => settings.updateEditor({ tabSize: Number(e.target.value) })}
                    className="settings-input w-20"
                  />
                </Field>
                <Field label="Line width (px, 0 = full width)">
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={settings.editor.lineWidth}
                    onChange={(e) => settings.updateEditor({ lineWidth: Number(e.target.value) })}
                    className="settings-input w-24"
                  />
                </Field>
                <ToggleField
                  label="Word wrap"
                  checked={settings.editor.wordWrap}
                  onChange={(v) => settings.updateEditor({ wordWrap: v })}
                />
                <ToggleField
                  label="Show line numbers"
                  checked={settings.editor.lineNumbers}
                  onChange={(v) => settings.updateEditor({ lineNumbers: v })}
                />
              </div>
            )}

            {tab === 'graph' && (
              <div className="space-y-4">
                <Field label="Node size">
                  <input
                    type="range"
                    min={3}
                    max={14}
                    value={settings.graph.nodeSize}
                    onChange={(e) => settings.updateGraph({ nodeSize: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Link distance">
                  <input
                    type="range"
                    min={20}
                    max={220}
                    value={settings.graph.linkDistance}
                    onChange={(e) => settings.updateGraph({ linkDistance: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Default local graph depth">
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={settings.graph.depth}
                    onChange={(e) => settings.updateGraph({ depth: Number(e.target.value) })}
                    className="settings-input w-20"
                  />
                </Field>
                <ToggleField label="Show labels" checked={settings.graph.showLabels} onChange={(v) => settings.updateGraph({ showLabels: v })} />
                <ToggleField label="Show arrows" checked={settings.graph.showArrows} onChange={(v) => settings.updateGraph({ showArrows: v })} />
                <ToggleField label="Animate layout" checked={settings.graph.animate} onChange={(v) => settings.updateGraph({ animate: v })} />
                <ToggleField label="Show orphan notes" checked={settings.graph.showOrphans} onChange={(v) => settings.updateGraph({ showOrphans: v })} />
                <ToggleField label="Show unresolved links" checked={settings.graph.showUnresolved} onChange={(v) => settings.updateGraph({ showUnresolved: v })} />
              </div>
            )}

            {tab === 'daily-notes' && (
              <div className="space-y-4">
                <Field label="Folder">
                  <input
                    value={settings.dailyNotes.folder}
                    onChange={(e) => settings.updateDailyNotes({ folder: e.target.value })}
                    className="settings-input w-48"
                  />
                </Field>
                <Field label="Date format (strftime)">
                  <input
                    value={settings.dailyNotes.dateFormat}
                    onChange={(e) => settings.updateDailyNotes({ dateFormat: e.target.value })}
                    className="settings-input w-48"
                  />
                </Field>
                <Field label="Template path (optional)">
                  <input
                    value={settings.dailyNotes.templatePath}
                    onChange={(e) => settings.updateDailyNotes({ templatePath: e.target.value })}
                    placeholder="Templates/Daily.md"
                    className="settings-input w-48"
                  />
                </Field>
              </div>
            )}

            {tab === 'templates' && <TemplatesTab />}
            {tab === 'hotkeys' && <HotkeysTab />}
            {tab === 'plugins' && <PluginsTab />}

            {tab === 'vault' && vault && (
              <div className="space-y-3 text-sm">
                <Field label="Name">
                  <span className="text-[var(--color-text-muted)]">{vault.name}</span>
                </Field>
                <Field label="Slug">
                  <span className="text-[var(--color-text-muted)]">{vault.slug}</span>
                </Field>
                <Field label="Created">
                  <span className="text-[var(--color-text-muted)]">{new Date(vault.created_at).toLocaleString()}</span>
                </Field>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm text-[var(--color-text-muted)]">{label}</label>
      {children}
    </div>
  )
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Field label={label}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </Field>
  )
}
