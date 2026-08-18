import { useEffect, useState } from 'react'
import { Plus, Trash2, FileText } from 'lucide-react'
import { api } from '@/api/client'
import { useVaultStore } from '@/store/vaultStore'
import type { TemplateSummary } from '@/types'

export function TemplatesTab() {
  const vault = useVaultStore((s) => s.currentVault)
  const refreshTree = useVaultStore((s) => s.refreshTree)
  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [name, setName] = useState('')

  const load = async () => {
    if (!vault) return
    setTemplates(await api.listTemplates(vault.id))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vault])

  const create = async () => {
    if (!vault || !name.trim()) return
    const placeholderContent =
      '---\ncreated: {{date}}\ntags:\n  - meeting\n---\n\n# {{title}}\n\n## Agenda\n\n## Discussion\n\n## Action Items\n'
    await api.createTemplate(vault.id, name.trim(), `Templates/${name.trim()}.md`, placeholderContent)
    setName('')
    await load()
    await refreshTree()
  }

  const remove = async (id: string) => {
    if (!vault) return
    await api.deleteTemplate(vault.id, id)
    await load()
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--color-text-faint)]">
        Templates support <code className="text-[var(--color-accent)]">{'{{date}}'}</code>,{' '}
        <code className="text-[var(--color-accent)]">{'{{time}}'}</code> and{' '}
        <code className="text-[var(--color-accent)]">{'{{title}}'}</code> placeholders, filled in when applied.
      </p>
      <div className="space-y-1">
        {templates.map((t) => (
          <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--color-bg-inset)] group">
            <FileText size={13} className="text-[var(--color-text-faint)]" />
            <span className="text-sm flex-1 truncate">{t.name}</span>
            <span className="text-xs text-[var(--color-text-faint)] truncate">{t.path}</span>
            <button onClick={() => remove(t.id)} className="p-1 opacity-0 group-hover:opacity-100 text-[var(--color-danger)]">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {templates.length === 0 && <div className="text-xs text-[var(--color-text-faint)]">No templates yet.</div>}
      </div>
      <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
          placeholder="Template name"
          className="settings-input flex-1"
        />
        <button onClick={create} className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm text-white" style={{ background: 'var(--color-accent)' }}>
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  )
}
