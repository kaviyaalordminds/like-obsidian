import { useMemo } from 'react'
import CodeMirror, { EditorView, keymap } from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { indentUnit } from '@codemirror/language'
import { defaultKeymap, historyKeymap, indentWithTab } from '@codemirror/commands'
import { useSettingsStore } from '@/store/settingsStore'

interface Props {
  value: string
  onChange: (value: string) => void
  onSaveShortcut?: () => void
  onEditorReady?: (view: EditorView) => void
}

export function NoteEditor({ value, onChange, onSaveShortcut, onEditorReady }: Props) {
  const editorSettings = useSettingsStore((s) => s.editor)

  const extensions = useMemo(() => {
    const exts = [
      markdown(),
      indentUnit.of(' '.repeat(editorSettings.tabSize)),
      EditorView.lineWrapping,
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        indentWithTab,
        {
          key: 'Mod-s',
          run: () => {
            onSaveShortcut?.()
            return true
          },
        },
      ]),
    ]
    return exts
  }, [editorSettings.tabSize, onSaveShortcut])

  return (
    <div
      className="h-full overflow-auto"
      style={{
        fontSize: `${editorSettings.fontSize}px`,
        ['--cm-max-width' as string]: editorSettings.lineWidth ? `${editorSettings.lineWidth}px` : 'none',
      }}
    >
      <div className="mx-auto" style={{ maxWidth: editorSettings.lineWidth || undefined }}>
        <CodeMirror
          value={value}
          onChange={onChange}
          extensions={extensions}
          basicSetup={{
            lineNumbers: editorSettings.lineNumbers,
            foldGutter: false,
            highlightActiveLine: true,
            autocompletion: false,
          }}
          theme="none"
          className="note-editor-cm"
          onCreateEditor={(view) => onEditorReady?.(view)}
        />
      </div>
    </div>
  )
}
