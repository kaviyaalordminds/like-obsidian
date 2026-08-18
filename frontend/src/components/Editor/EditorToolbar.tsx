import type { EditorView } from '@uiw/react-codemirror'
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Link2,
  Image as ImageIcon,
  Table as TableIcon,
  Minus,
  Brackets,
} from 'lucide-react'
import { formatActions } from './formatting'

interface Props {
  getView: () => EditorView | null
}

const buttons: { icon: React.ComponentType<{ size?: number }>; action: keyof typeof formatActions; label: string }[] = [
  { icon: Bold, action: 'bold', label: 'Bold' },
  { icon: Italic, action: 'italic', label: 'Italic' },
  { icon: Strikethrough, action: 'strikethrough', label: 'Strikethrough' },
  { icon: Heading2, action: 'heading', label: 'Heading' },
  { icon: List, action: 'bulletList', label: 'Bullet list' },
  { icon: ListOrdered, action: 'numberedList', label: 'Numbered list' },
  { icon: CheckSquare, action: 'checklist', label: 'Checklist' },
  { icon: Quote, action: 'blockquote', label: 'Blockquote' },
  { icon: Code, action: 'codeBlock', label: 'Code block' },
  { icon: Link2, action: 'link', label: 'Link' },
  { icon: Brackets, action: 'wikilink', label: 'Wikilink' },
  { icon: ImageIcon, action: 'image', label: 'Image' },
  { icon: TableIcon, action: 'table', label: 'Table' },
  { icon: Minus, action: 'horizontalRule', label: 'Horizontal rule' },
]

export function EditorToolbar({ getView }: Props) {
  return (
    <div className="flex items-center gap-0.5 px-2 py-1 border-b" style={{ borderColor: 'var(--color-border)' }}>
      {buttons.map(({ icon: Icon, action, label }) => (
        <button
          key={action}
          title={label}
          className="p-1.5 rounded hover:bg-[var(--color-bg-inset)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const view = getView()
            if (view) formatActions[action](view)
          }}
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  )
}
