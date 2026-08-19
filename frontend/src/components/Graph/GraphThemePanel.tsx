import { useState } from 'react'
import { Copy, Download, Palette, RotateCcw, Trash2, Upload, X } from 'lucide-react'
import { useSettingsStore } from '@/store/settingsStore'
import { useGraphStore } from '@/store/graphStore'
import {
  BUILTIN_GRAPH_THEMES,
  duplicateTheme,
  getGraphTheme,
  parseImportedTheme,
  type GraphThemeColors,
} from '@/lib/graphThemes'

const COLOR_FIELDS: { key: keyof GraphThemeColors; label: string }[] = [
  { key: 'background', label: 'Background' },
  { key: 'node', label: 'Node' },
  { key: 'nodeSelected', label: 'Selected node' },
  { key: 'nodeHover', label: 'Hover node' },
  { key: 'edge', label: 'Edge' },
  { key: 'edgeSelected', label: 'Selected edge' },
  { key: 'text', label: 'Text' },
  { key: 'cluster', label: 'Cluster' },
  { key: 'orphan', label: 'Orphan' },
  { key: 'unresolved', label: 'Unresolved link' },
  { key: 'tag', label: 'Tag' },
  { key: 'folder', label: 'Folder' },
  { key: 'glow', label: 'Glow' },
  { key: 'grid', label: 'Grid' },
]

export function GraphThemePanel({ onClose }: { onClose: () => void }) {
  const themeId = useGraphStore((s) => s.themeId)
  const setThemeId = useGraphStore((s) => s.setThemeId)
  const custom = useSettingsStore((s) => s.customGraphThemes)
  const addCustom = useSettingsStore((s) => s.addCustomGraphTheme)
  const updateCustom = useSettingsStore((s) => s.updateCustomGraphTheme)
  const deleteCustom = useSettingsStore((s) => s.deleteCustomGraphTheme)
  const active = getGraphTheme(themeId, custom)
  const editing = custom.find((t) => t.id === themeId)
  const [importError, setImportError] = useState<string | null>(null)

  const newFromCurrent = () => {
    const copy = duplicateTheme(active, `${active.name} copy`)
    addCustom(copy)
    setThemeId(copy.id)
  }

  const resetToBase = () => {
    if (!editing) return
    const base = editing.baseId ? getGraphTheme(editing.baseId) : BUILTIN_GRAPH_THEMES[0]
    updateCustom(editing.id, { colors: { ...base.colors } })
  }

  const exportTheme = () => {
    const blob = new Blob([JSON.stringify({ name: active.name, colors: active.colors }, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${active.id}.graph-theme.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importTheme = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      setImportError(null)
      try {
        const parsed = parseImportedTheme(JSON.parse(await file.text()))
        if ('error' in parsed) {
          setImportError(parsed.error)
          return
        }
        addCustom(parsed)
        setThemeId(parsed.id)
      } catch {
        setImportError('Could not parse that file as JSON')
      }
    }
    input.click()
  }

  return (
    <div className="w-72 glass-panel rounded-lg p-3 max-h-[70vh] overflow-auto" style={{ boxShadow: 'var(--shadow-glow)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase text-[var(--color-text-faint)]">
          <Palette size={12} /> Graph theme
        </span>
        <button onClick={onClose} className="p-1 rounded hover:bg-[var(--color-bg-inset)]">
          <X size={13} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1 mb-3">
        {BUILTIN_GRAPH_THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => setThemeId(t.id)}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-left truncate"
            style={{
              background: themeId === t.id ? 'var(--color-accent-soft)' : 'transparent',
              color: themeId === t.id ? 'var(--color-accent)' : 'var(--color-text)',
            }}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.colors.node }} />
            {t.name}
          </button>
        ))}
      </div>

      {custom.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-semibold uppercase text-[var(--color-text-faint)] mb-1">Custom</div>
          <div className="grid grid-cols-2 gap-1">
            {custom.map((t) => (
              <button
                key={t.id}
                onClick={() => setThemeId(t.id)}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-left truncate"
                style={{
                  background: themeId === t.id ? 'var(--color-accent-soft)' : 'transparent',
                  color: themeId === t.id ? 'var(--color-accent)' : 'var(--color-text)',
                }}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.colors.node }} />
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 mb-3 flex-wrap">
        <button
          onClick={newFromCurrent}
          className="flex items-center gap-1 px-2 py-1 rounded border text-xs"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <Copy size={11} /> New from current
        </button>
        <button
          onClick={exportTheme}
          className="flex items-center gap-1 px-2 py-1 rounded border text-xs"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <Download size={11} /> Export
        </button>
        <button
          onClick={importTheme}
          className="flex items-center gap-1 px-2 py-1 rounded border text-xs"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <Upload size={11} /> Import
        </button>
      </div>
      {importError && <div className="text-xs text-[var(--color-danger)] mb-2">{importError}</div>}

      {editing && (
        <div className="pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center justify-between mb-2">
            <input
              value={editing.name}
              onChange={(e) => updateCustom(editing.id, { name: e.target.value })}
              className="settings-input text-xs flex-1 mr-2"
            />
            <button onClick={resetToBase} title="Reset to base theme" className="p-1 rounded hover:bg-[var(--color-bg-inset)]">
              <RotateCcw size={12} />
            </button>
            <button
              onClick={() => {
                deleteCustom(editing.id)
                setThemeId('obsidian-classic')
              }}
              title="Delete theme"
              className="p-1 rounded hover:bg-[var(--color-bg-inset)] text-[var(--color-danger)]"
            >
              <Trash2 size={12} />
            </button>
          </div>
          <div className="space-y-1.5">
            {COLOR_FIELDS.map(({ key, label }) => (
              <label key={key} className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-muted)]">{label}</span>
                <input
                  type="color"
                  value={editing.colors[key]}
                  onChange={(e) => updateCustom(editing.id, { colors: { ...editing.colors, [key]: e.target.value } })}
                  className="w-8 h-6 rounded border-0 bg-transparent cursor-pointer"
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
