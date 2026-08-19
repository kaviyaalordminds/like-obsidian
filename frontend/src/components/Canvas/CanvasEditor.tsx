import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Link2, Save, Type } from 'lucide-react'
import { api } from '@/api/client'
import { useVaultStore } from '@/store/vaultStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useUIStore } from '@/store/uiStore'
import { flattenFiles } from '@/lib/tree'
import { debounce } from '@/lib/debounce'
import type { CanvasDocument, CanvasNode } from '@/types'

interface Props {
  vaultId: string
  path: string
}

const BOARD_W = 3000
const BOARD_H = 2000

export function CanvasEditor({ vaultId, path }: Props) {
  const tree = useVaultStore((s) => s.tree)
  const openNote = useWorkspaceStore((s) => s.openNote)
  const setMainView = useUIStore((s) => s.setMainView)
  const files = useMemo(() => flattenFiles(tree).filter((f) => f.is_markdown), [tree])

  const [doc, setDoc] = useState<CanvasDocument | null>(null)
  const [dragging, setDragging] = useState<{ id: string; dx: number; dy: number } | null>(null)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved')
  const boardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    api.readCanvas(vaultId, path).then(setDoc)
  }, [vaultId, path])

  const persist = useMemo(
    () =>
      debounce((next: CanvasDocument) => {
        setSaveStatus('saving')
        api.writeCanvas(vaultId, path, next).then(() => setSaveStatus('saved'))
      }, 500),
    [vaultId, path],
  )

  const update = (next: CanvasDocument) => {
    setDoc(next)
    persist(next)
  }

  const addNoteCard = (notePath: string, title: string) => {
    if (!doc) return
    const id = crypto.randomUUID()
    const node: CanvasNode = {
      id,
      type: 'note',
      x: 80 + Math.random() * 200,
      y: 80 + Math.random() * 200,
      width: 240,
      height: 100,
      note_path: notePath,
      text: title,
      color: null,
    }
    update({ ...doc, nodes: [...doc.nodes, node] })
    setPickerOpen(false)
  }

  const addTextCard = () => {
    if (!doc) return
    const id = crypto.randomUUID()
    const node: CanvasNode = {
      id,
      type: 'text',
      x: 80,
      y: 80,
      width: 220,
      height: 90,
      note_path: null,
      text: 'New note card',
      color: null,
    }
    update({ ...doc, nodes: [...doc.nodes, node] })
  }

  const updateNode = (id: string, patch: Partial<CanvasNode>) => {
    if (!doc) return
    update({ ...doc, nodes: doc.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) })
  }

  const deleteNode = (id: string) => {
    if (!doc) return
    update({
      nodes: doc.nodes.filter((n) => n.id !== id),
      edges: doc.edges.filter((e) => e.from_node !== id && e.to_node !== id),
    })
  }

  const onCardMouseDown = (e: React.MouseEvent, node: CanvasNode) => {
    if ((e.target as HTMLElement).closest('button')) return
    const boardRect = boardRef.current?.getBoundingClientRect()
    if (!boardRect) return
    const boardX = e.clientX - boardRect.left + (boardRef.current?.scrollLeft ?? 0)
    const boardY = e.clientY - boardRect.top + (boardRef.current?.scrollTop ?? 0)
    setDragging({ id: node.id, dx: boardX - node.x, dy: boardY - node.y })
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const boardRect = boardRef.current?.getBoundingClientRect()
      if (!boardRect || !doc) return
      const boardX = e.clientX - boardRect.left + (boardRef.current?.scrollLeft ?? 0)
      const boardY = e.clientY - boardRect.top + (boardRef.current?.scrollTop ?? 0)
      updateNode(dragging.id, { x: Math.max(0, boardX - dragging.dx), y: Math.max(0, boardY - dragging.dy) })
    }
    const onUp = () => setDragging(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, doc])

  const onCardClick = (node: CanvasNode) => {
    if (!connecting) return
    if (connecting === node.id) {
      setConnecting(null)
      return
    }
    if (!doc) return
    update({
      ...doc,
      edges: [...doc.edges, { id: crypto.randomUUID(), from_node: connecting, to_node: node.id, label: null }],
    })
    setConnecting(null)
  }

  if (!doc) return <div className="h-full flex items-center justify-center text-sm text-[var(--color-text-faint)]">Loading canvas…</div>

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b text-xs" style={{ borderColor: 'var(--color-border)' }}>
        <div className="relative">
          <button
            onClick={() => setPickerOpen((v) => !v)}
            className="flex items-center gap-1 px-2 py-1 rounded border"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <FileText size={12} /> Add note card
          </button>
          {pickerOpen && (
            <div
              className="absolute top-full left-0 mt-1 w-64 max-h-64 overflow-auto glass-panel rounded-lg z-10"
              style={{ boxShadow: 'var(--shadow-glow)' }}
            >
              {files.map((f) => (
                <button
                  key={f.path}
                  onClick={() => addNoteCard(f.path, f.name.replace(/\.md$/i, ''))}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--color-bg-inset)] truncate"
                >
                  {f.name.replace(/\.md$/i, '')}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={addTextCard} className="flex items-center gap-1 px-2 py-1 rounded border" style={{ borderColor: 'var(--color-border)' }}>
          <Type size={12} /> Add text card
        </button>
        <button
          onClick={() => setConnecting(connecting ? null : '__pending__')}
          className="flex items-center gap-1 px-2 py-1 rounded border"
          style={{
            borderColor: connecting ? 'var(--color-accent)' : 'var(--color-border)',
            color: connecting ? 'var(--color-accent)' : undefined,
          }}
        >
          <Link2 size={12} /> {connecting === '__pending__' ? 'Click first card…' : connecting ? 'Click second card…' : 'Connect'}
        </button>
        <span className="ml-auto flex items-center gap-1 text-[var(--color-text-faint)]">
          <Save size={11} /> {saveStatus === 'saving' ? 'Saving…' : 'Saved'}
        </span>
      </div>

      <div ref={boardRef} className="flex-1 overflow-auto relative bg-grid" style={{ background: 'var(--color-bg-inset)' }}>
        <div className="relative" style={{ width: BOARD_W, height: BOARD_H }}>
          <svg width={BOARD_W} height={BOARD_H} className="absolute inset-0 pointer-events-none">
            {doc.edges.map((e) => {
              const from = doc.nodes.find((n) => n.id === e.from_node)
              const to = doc.nodes.find((n) => n.id === e.to_node)
              if (!from || !to) return null
              const x1 = from.x + from.width / 2
              const y1 = from.y + from.height / 2
              const x2 = to.x + to.width / 2
              const y2 = to.y + to.height / 2
              return <line key={e.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-accent)" strokeWidth={1.5} opacity={0.5} />
            })}
          </svg>

          {doc.nodes.map((node) => (
            <div
              key={node.id}
              onMouseDown={(e) => onCardMouseDown(e, node)}
              onClick={() => onCardClick(node)}
              onDoubleClick={() => {
                if (node.type === 'note' && node.note_path) {
                  openNote(node.note_path)
                  setMainView('editor')
                }
              }}
              className="absolute rounded-lg border p-3 cursor-move select-none glass-panel"
              style={{
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
                borderColor: connecting && connecting !== '__pending__' ? undefined : 'var(--color-border)',
                boxShadow: 'var(--shadow-glow)',
              }}
            >
              <div className="flex items-center justify-between mb-1">
                {node.type === 'note' ? (
                  <span className="flex items-center gap-1 text-xs text-[var(--color-accent)]">
                    <FileText size={11} /> Note
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-[var(--color-text-faint)]">
                    <Type size={11} /> Text
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteNode(node.id)
                  }}
                  className="text-[var(--color-text-faint)] hover:text-[var(--color-danger)] text-xs"
                >
                  ✕
                </button>
              </div>
              {node.type === 'text' ? (
                <textarea
                  value={node.text ?? ''}
                  onChange={(e) => updateNode(node.id, { text: e.target.value })}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-full h-[calc(100%-24px)] bg-transparent text-sm outline-none resize-none"
                />
              ) : (
                <div className="text-sm font-medium truncate">{node.text}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
