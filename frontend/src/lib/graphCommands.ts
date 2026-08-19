// The Graph Command API (Part 30): the AI never touches the DOM or reaches
// into a store directly. It can only emit one of a handful of typed
// `graph_*` tool results (see backend/app/services/ai/tools.py), and this
// is the one place those get turned into real store calls — the same
// store calls a toolbar button would make.
import { useGraphStore, type GraphMode } from '@/store/graphStore'
import { useUIStore } from '@/store/uiStore'
import { useWorkspaceStore } from '@/store/workspaceStore'

interface GraphCommandResult {
  command?: string
  path?: string
  mode?: string
  paths?: string[]
  depth?: number
}

const GRAPH_TOOL_NAMES = new Set(['graph_focus_node', 'graph_set_mode', 'graph_highlight_nodes', 'graph_show_local_graph'])

export function isGraphCommandTool(toolName: string): boolean {
  return GRAPH_TOOL_NAMES.has(toolName)
}

export function applyGraphCommand(toolName: string, result: unknown): void {
  if (!isGraphCommandTool(toolName)) return
  const r = result as GraphCommandResult
  const gs = useGraphStore.getState()
  const ui = useUIStore.getState()

  switch (r?.command) {
    case 'focus_node':
      if (r.path) {
        gs.selectNode(r.path)
        ui.setMainView('graph')
      }
      break
    case 'set_mode':
      if (r.mode) {
        gs.setMode(r.mode as GraphMode)
        ui.setMainView('graph')
      }
      break
    case 'highlight_nodes':
      if (r.paths?.length) gs.highlightNodes(r.paths)
      ui.setMainView('graph')
      break
    case 'show_local_graph':
      if (r.path) {
        useWorkspaceStore.getState().openNote(r.path)
        ui.setMainView('editor')
        ui.setRightPanelTab('local-graph')
      }
      break
    default:
      break
  }
}
