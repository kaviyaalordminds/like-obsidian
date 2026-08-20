export interface Vault {
  id: string
  name: string
  slug: string
  icon: string
  created_at: string
  last_opened_at: string
  external_path: string | null
  is_obsidian_vault: boolean
}

export interface TreeNode {
  name: string
  path: string
  type: 'folder' | 'file'
  is_markdown: boolean
  modified_at: number | null
  size: number | null
  children: TreeNode[]
}

export interface Heading {
  level: number
  text: string
  line: number
}

export interface NoteLink {
  target: string
  alias: string | null
  raw: string
}

export interface Note {
  path: string
  title: string
  content: string
  frontmatter: Record<string, unknown>
  tags: string[]
  headings: Heading[]
  links: NoteLink[]
  modified_at: number | null
}

export interface GraphNode {
  id: string
  path: string | null
  title: string
  type: 'note' | 'unresolved'
  tags: string[]
  folder: string
  created_at: number | null
  updated_at: number | null
  word_count: number
  status: string | null
}

export interface GraphEdge {
  source: string
  target: string
  type: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface Backlink {
  path: string
  title: string
  context: string
}

export interface BacklinksResponse {
  backlinks: Backlink[]
  unlinked_mentions: { path: string; title: string }[]
}

export interface LinkSuggestion {
  title: string
  target_path: string
  mention: string
}

export interface TagSuggestion {
  tag: string
  mention: string
}

export interface NoteSuggestions {
  links: LinkSuggestion[]
  tags: TagSuggestion[]
}

export interface SearchResult {
  path: string
  title: string
  folder: string
  score: number
  snippets: string[]
  matched_tags: string[]
}

export interface TemplateSummary {
  id: string
  name: string
  path: string
}

export interface PluginInfo {
  id: string
  name: string
  description: string
  enabled: boolean
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict'

// --- Graph metrics / clusters / path ---

export interface MostConnected {
  id: string
  title: string
  connections: number
}

export interface GraphStats {
  node_count: number
  edge_count: number
  cluster_count: number
  orphan_count: number
  density: number
  avg_connections: number
  most_connected: MostConnected[]
}

export interface GraphCluster {
  id: string
  label: string
  node_ids: string[]
}

// --- Knowledge health ---

export interface HealthReport {
  orphan_count: number
  broken_link_count: number
  duplicate_count: number
  unused_tag_count: number
  empty_note_count: number
  large_note_count: number
  old_note_count: number
  no_metadata_count: number
  recommendations: string[]
}

export interface OrphanNote {
  path: string
  title: string
  folder: string
}

export interface BrokenLinkGroup {
  target: string
  referenced_from: { path: string; title: string }[]
}

export interface DuplicateCandidate {
  a: { path: string; title: string }
  b: { path: string; title: string }
  similarity: number
}

// --- Tags ---

export interface RelatedTag {
  tag: string
  co_occurrences: number
}

export interface TaggedNote {
  path: string
  title: string
  modified_at: number
}

// --- Collections ---

export interface NoteFilterCriteria {
  folder?: string
  tags?: string[]
  created_after?: number
  created_before?: number
  modified_after?: number
  modified_before?: number
  min_links?: number
  min_backlinks?: number
  orphans_only?: boolean
  pinned_only?: boolean
  has_unresolved_only?: boolean
  daily_notes_only?: boolean
}

export interface Collection {
  id: string
  name: string
  filter: NoteFilterCriteria
  created_at: string
}

export interface FilteredNote {
  path: string
  title: string
  folder: string
  tags: string[]
  modified_at: number
  link_count: number
  backlink_count: number
}

// --- Graph snapshots ---

export interface GraphSnapshotState {
  mode?: string
  colorStrategy?: string
  themeId?: string
  relationKinds?: string[]
  filters?: NoteFilterCriteria
  query?: string
  zoom?: number
  pan?: { x: number; y: number }
  selectedNodeId?: string | null
  pinnedNodeIds?: string[]
  hiddenNodeIds?: string[]
}

export interface GraphSnapshot {
  id: string
  name: string
  state: GraphSnapshotState
  created_at: string
}

// --- Canvas ---

export interface CanvasNode {
  id: string
  type: 'note' | 'text' | 'group'
  x: number
  y: number
  width: number
  height: number
  note_path: string | null
  text: string | null
  color: string | null
}

export interface CanvasEdge {
  id: string
  from_node: string
  to_node: string
  label: string | null
}

export interface CanvasDocument {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

// --- Activity ---

export interface ActivityEntry {
  id: string
  note_path: string
  action: 'create' | 'rename' | 'move' | 'delete' | 'save'
  detail: string
  created_at: string
}

// --- AI Agent ---

export interface AIConfig {
  configured: boolean
  provider: string
  model: string
  auto_approve_safe: boolean
}

export interface AIAction {
  id: string
  conversation_id: string
  tool_name: string
  tool_input: Record<string, unknown>
  safety: 'read' | 'write' | 'destructive'
  status: 'executed' | 'pending' | 'approved' | 'rejected' | 'error'
  summary: string
  result: string
  created_at: string
}

export interface AIToolCallRecord {
  toolName: string
  toolInput: Record<string, unknown>
  result?: unknown
  status: 'running' | 'done' | 'pending_confirmation' | 'rejected'
  actionId?: string
  safety?: string
}

export interface AIChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  toolCalls: AIToolCallRecord[]
}

export interface AIContextSelection {
  kind: 'note' | 'notes' | 'local_graph' | 'cluster' | 'search_results' | 'folder' | 'vault'
  paths?: string[]
  path?: string
  folder?: string
  depth?: number
}

export interface AIContextPreview {
  note_count: number
  word_count: number
  tags: string[]
  paths: string[]
}

export interface ObsidianConnectionConfig {
  configured: boolean
  host: string
  port: number
  use_https: boolean
  verify_ssl: boolean
}

export interface ObsidianTestResult {
  ok: boolean
  authenticated: boolean
  service: string
  error: string | null
}
