const hotkeys = [
  { keys: 'Ctrl / Cmd + P', action: 'Quick switcher' },
  { keys: 'Ctrl / Cmd + O', action: 'Quick switcher' },
  { keys: 'Ctrl / Cmd + K', action: 'Command palette' },
  { keys: 'Ctrl / Cmd + Shift + F', action: 'Search vault' },
  { keys: 'Ctrl / Cmd + N', action: 'New note' },
  { keys: 'Ctrl / Cmd + S', action: 'Save note' },
  { keys: 'Ctrl / Cmd + Shift + G', action: 'Open graph' },
  { keys: 'Ctrl / Cmd + ,', action: 'Open settings' },
  { keys: 'Alt + ←', action: 'Navigate back' },
  { keys: 'Alt + →', action: 'Navigate forward' },
]

export function HotkeysTab() {
  return (
    <div className="space-y-1">
      <p className="text-xs text-[var(--color-text-faint)] mb-3">
        Custom hotkey remapping is planned; these are the current defaults.
      </p>
      {hotkeys.map((h) => (
        <div key={h.action} className="flex items-center justify-between px-2 py-1.5 text-sm">
          <span className="text-[var(--color-text-muted)]">{h.action}</span>
          <kbd className="px-2 py-0.5 rounded text-xs" style={{ background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)' }}>
            {h.keys}
          </kbd>
        </div>
      ))}
    </div>
  )
}
