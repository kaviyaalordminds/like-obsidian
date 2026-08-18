import type { EditorView } from '@uiw/react-codemirror'
import { EditorSelection } from '@codemirror/state'

function wrapSelection(view: EditorView, before: string, after = before) {
  const { state } = view
  const changes = state.changeByRange((range) => {
    const selected = state.sliceDoc(range.from, range.to)
    const insert = `${before}${selected}${after}`
    const anchor = range.from + before.length
    const head = anchor + selected.length
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.range(anchor, head),
    }
  })
  view.dispatch(state.update(changes))
  view.focus()
}

function insertLinePrefix(view: EditorView, prefix: string) {
  const { state } = view
  const changes = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.from)
    return {
      changes: { from: line.from, to: line.from, insert: prefix },
      range: EditorSelection.range(range.anchor + prefix.length, range.head + prefix.length),
    }
  })
  view.dispatch(state.update(changes))
  view.focus()
}

function insertBlock(view: EditorView, template: string, cursorOffset: number) {
  const { state } = view
  const pos = state.selection.main.from
  const needsNewlineBefore = pos > 0 && state.doc.sliceString(pos - 1, pos) !== '\n'
  const insert = `${needsNewlineBefore ? '\n' : ''}${template}`
  view.dispatch({
    changes: { from: pos, insert },
    selection: { anchor: pos + insert.length - cursorOffset },
  })
  view.focus()
}

export const formatActions = {
  bold: (v: EditorView) => wrapSelection(v, '**'),
  italic: (v: EditorView) => wrapSelection(v, '_'),
  strikethrough: (v: EditorView) => wrapSelection(v, '~~'),
  inlineCode: (v: EditorView) => wrapSelection(v, '`'),
  heading: (v: EditorView) => insertLinePrefix(v, '## '),
  bulletList: (v: EditorView) => insertLinePrefix(v, '- '),
  numberedList: (v: EditorView) => insertLinePrefix(v, '1. '),
  checklist: (v: EditorView) => insertLinePrefix(v, '- [ ] '),
  blockquote: (v: EditorView) => insertLinePrefix(v, '> '),
  codeBlock: (v: EditorView) => insertBlock(v, '```\n\n```\n', 4),
  link: (v: EditorView) => wrapSelection(v, '[', '](url)'),
  image: (v: EditorView) => insertBlock(v, '![alt](image-url)\n', 0),
  table: (v: EditorView) =>
    insertBlock(v, '| Column A | Column B |\n| --- | --- |\n| value | value |\n', 0),
  horizontalRule: (v: EditorView) => insertBlock(v, '---\n', 0),
  wikilink: (v: EditorView) => wrapSelection(v, '[[', ']]'),
}
