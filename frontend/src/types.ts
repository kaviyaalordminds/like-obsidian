export interface Vault {
  id: string
  name: string
  slug: string
  icon: string
  created_at: string
  last_opened_at: string
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
  updated_at: number | null
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

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
