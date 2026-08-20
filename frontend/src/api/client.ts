import type {
  ActivityEntry,
  AIAction,
  AIConfig,
  AIContextPreview,
  AIContextSelection,
  BacklinksResponse,
  BrokenLinkGroup,
  CanvasDocument,
  Collection,
  DuplicateCandidate,
  FilteredNote,
  GraphCluster,
  GraphData,
  GraphSnapshot,
  GraphStats,
  HealthReport,
  Note,
  NoteFilterCriteria,
  NoteSuggestions,
  ObsidianConnectionConfig,
  ObsidianTestResult,
  OrphanNote,
  PluginInfo,
  RelatedTag,
  SearchResult,
  TaggedNote,
  TemplateSummary,
  TreeNode,
  Vault,
} from '@/types'

const BASE = '/api'

class ApiError extends Error {
  status: number
  /** The raw `detail` field from the error body — a string for most errors,
   * but a structured payload for endpoints that need to hand back more than
   * text (e.g. a 409 conflict carrying the current on-disk note). */
  detail: unknown
  constructor(status: number, message: string, detail?: unknown) {
    super(message)
    this.status = status
    this.detail = detail
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: init?.body && !(init.body instanceof FormData) ? { 'content-type': 'application/json' } : undefined,
    ...init,
  })
  if (!res.ok) {
    let detail: unknown = res.statusText
    try {
      const body = await res.json()
      detail = body.detail ?? detail
    } catch {
      // ignore
    }
    throw new ApiError(res.status, typeof detail === 'string' ? detail : res.statusText, detail)
  }
  if (res.status === 204) return undefined as T
  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) return res.json()
  return res.blob() as unknown as T
}

export const api = {
  // Vaults
  listVaults: () => request<Vault[]>('/vaults'),
  createVault: (name: string, icon = '📓') =>
    request<Vault>('/vaults', { method: 'POST', body: JSON.stringify({ name, icon }) }),
  connectVault: (path: string, name?: string, icon = '📁') =>
    request<Vault>('/vaults/connect', { method: 'POST', body: JSON.stringify({ path, name, icon }) }),
  openVault: (vaultId: string) => request<TreeNode>(`/vaults/${vaultId}/open`, { method: 'POST' }),
  getTree: (vaultId: string) => request<TreeNode>(`/vaults/${vaultId}/tree`),
  forgetVault: (vaultId: string) => request<void>(`/vaults/${vaultId}`, { method: 'DELETE' }),

  // Notes
  getNote: (vaultId: string, path: string) =>
    request<Note>(`/vaults/${vaultId}/notes/${encodeSegments(path)}`),
  createNote: (vaultId: string, path: string, content = '') =>
    request<Note>(`/vaults/${vaultId}/notes`, { method: 'POST', body: JSON.stringify({ path, content }) }),
  saveNote: (vaultId: string, path: string, content: string, expectedMtime?: number | null) =>
    request<Note>(`/vaults/${vaultId}/notes/${encodeSegments(path)}`, {
      method: 'PUT',
      body: JSON.stringify({ content, expected_mtime: expectedMtime ?? undefined }),
    }),
  deleteNote: (vaultId: string, path: string) =>
    request<void>(`/vaults/${vaultId}/notes/${encodeSegments(path)}`, { method: 'DELETE' }),
  renameNote: (vaultId: string, path: string, newName: string) =>
    request<Note>(`/vaults/${vaultId}/notes/${encodeSegments(path)}/rename`, {
      method: 'POST',
      body: JSON.stringify({ new_name: newName }),
    }),
  moveNote: (vaultId: string, path: string, destination: string) =>
    request<Note>(`/vaults/${vaultId}/notes/${encodeSegments(path)}/move`, {
      method: 'POST',
      body: JSON.stringify({ destination }),
    }),

  // Folders
  createFolder: (vaultId: string, path: string) =>
    request(`/vaults/${vaultId}/folders`, { method: 'POST', body: JSON.stringify({ path }) }),
  deleteFolder: (vaultId: string, path: string) =>
    request<void>(`/vaults/${vaultId}/folders/${encodeSegments(path)}`, { method: 'DELETE' }),
  renameFolder: (vaultId: string, path: string, newName: string) =>
    request<{ path: string }>(`/vaults/${vaultId}/folders/${encodeSegments(path)}/rename`, {
      method: 'POST',
      body: JSON.stringify({ new_name: newName }),
    }),
  moveFolder: (vaultId: string, path: string, destination: string) =>
    request<{ path: string }>(`/vaults/${vaultId}/folders/${encodeSegments(path)}/move`, {
      method: 'POST',
      body: JSON.stringify({ destination }),
    }),

  // Search / tags
  search: (vaultId: string, q: string) =>
    request<SearchResult[]>(`/vaults/${vaultId}/search?q=${encodeURIComponent(q)}`),
  listTags: (vaultId: string) => request<Record<string, number>>(`/vaults/${vaultId}/tags`),
  notesForTag: (vaultId: string, tag: string) =>
    request<TaggedNote[]>(`/vaults/${vaultId}/tags/${encodeURIComponent(tag)}/notes`),
  relatedTags: (vaultId: string, tag: string) =>
    request<RelatedTag[]>(`/vaults/${vaultId}/tags/${encodeURIComponent(tag)}/related`),
  renameTag: (vaultId: string, tag: string, newTag: string) =>
    request<{ touched_notes: string[] }>(`/vaults/${vaultId}/tags/${encodeURIComponent(tag)}/rename`, {
      method: 'POST',
      body: JSON.stringify({ new_tag: newTag }),
    }),
  mergeTags: (vaultId: string, tags: string[], into: string) =>
    request<{ touched_notes: string[] }>(`/vaults/${vaultId}/tags/merge`, {
      method: 'POST',
      body: JSON.stringify({ tags, into }),
    }),
  deleteTag: (vaultId: string, tag: string) =>
    request<{ touched_notes: string[] }>(`/vaults/${vaultId}/tags/${encodeURIComponent(tag)}`, {
      method: 'DELETE',
    }),

  // Graph
  globalGraph: (
    vaultId: string,
    opts?: { includeUnresolved?: boolean; includeOrphans?: boolean; tags?: string[]; folder?: string; relations?: string[] },
  ) => {
    const params = new URLSearchParams()
    if (opts?.includeUnresolved !== undefined) params.set('include_unresolved', String(opts.includeUnresolved))
    if (opts?.includeOrphans !== undefined) params.set('include_orphans', String(opts.includeOrphans))
    if (opts?.folder) params.set('folder', opts.folder)
    opts?.tags?.forEach((t) => params.append('tag', t))
    opts?.relations?.forEach((r) => params.append('relations', r))
    const qs = params.toString()
    return request<GraphData>(`/vaults/${vaultId}/graph${qs ? `?${qs}` : ''}`)
  },
  localGraph: (vaultId: string, path: string, depth: number) =>
    request<GraphData>(`/vaults/${vaultId}/graph/local/${encodeSegments(path)}?depth=${depth}`),
  backlinks: (vaultId: string, path: string) =>
    request<BacklinksResponse>(`/vaults/${vaultId}/backlinks/${encodeSegments(path)}`),
  noteSuggestions: (vaultId: string, path: string) =>
    request<NoteSuggestions>(`/vaults/${vaultId}/notes/${encodeSegments(path)}/suggestions`),
  graphStats: (vaultId: string, clusterStrategy: 'folder' | 'connected' = 'folder') =>
    request<GraphStats>(`/vaults/${vaultId}/graph/stats?cluster_strategy=${clusterStrategy}`),
  graphClusters: (vaultId: string, strategy: 'folder' | 'connected' = 'folder') =>
    request<GraphCluster[]>(`/vaults/${vaultId}/graph/clusters?strategy=${strategy}`),
  knowledgePath: (vaultId: string, source: string, target: string) =>
    request<GraphData>(`/vaults/${vaultId}/graph/path`, {
      method: 'POST',
      body: JSON.stringify({ source, target }),
    }),

  // Knowledge health
  health: (vaultId: string) => request<HealthReport>(`/vaults/${vaultId}/health`),
  orphans: (vaultId: string) => request<OrphanNote[]>(`/vaults/${vaultId}/orphans`),
  brokenLinks: (vaultId: string) => request<BrokenLinkGroup[]>(`/vaults/${vaultId}/broken-links`),
  duplicates: (vaultId: string) => request<DuplicateCandidate[]>(`/vaults/${vaultId}/duplicates`),

  // Collections
  listCollections: (vaultId: string) => request<Collection[]>(`/vaults/${vaultId}/collections`),
  createCollection: (vaultId: string, name: string, filter: NoteFilterCriteria) =>
    request<Collection>(`/vaults/${vaultId}/collections`, {
      method: 'POST',
      body: JSON.stringify({ name, filter }),
    }),
  deleteCollection: (vaultId: string, id: string) =>
    request<void>(`/vaults/${vaultId}/collections/${id}`, { method: 'DELETE' }),
  collectionNotes: (vaultId: string, id: string) =>
    request<FilteredNote[]>(`/vaults/${vaultId}/collections/${id}/notes`),
  previewCollection: (vaultId: string, filter: NoteFilterCriteria) =>
    request<FilteredNote[]>(`/vaults/${vaultId}/collections/preview`, {
      method: 'POST',
      body: JSON.stringify({ name: '', filter }),
    }),

  // Graph snapshots
  listSnapshots: (vaultId: string) => request<GraphSnapshot[]>(`/vaults/${vaultId}/graph-snapshots`),
  createSnapshot: (vaultId: string, name: string, state: Record<string, unknown>) =>
    request<GraphSnapshot>(`/vaults/${vaultId}/graph-snapshots`, {
      method: 'POST',
      body: JSON.stringify({ name, state }),
    }),
  deleteSnapshot: (vaultId: string, id: string) =>
    request<void>(`/vaults/${vaultId}/graph-snapshots/${id}`, { method: 'DELETE' }),

  // Canvas
  listCanvases: (vaultId: string) => request<string[]>(`/vaults/${vaultId}/canvas`),
  createCanvas: (vaultId: string, path: string, name: string) =>
    request<{ path: string }>(`/vaults/${vaultId}/canvas`, {
      method: 'POST',
      body: JSON.stringify({ path, name }),
    }),
  readCanvas: (vaultId: string, path: string) =>
    request<CanvasDocument>(`/vaults/${vaultId}/canvas/${encodeSegments(path)}`),
  writeCanvas: (vaultId: string, path: string, doc: CanvasDocument) =>
    request<{ path: string }>(`/vaults/${vaultId}/canvas/${encodeSegments(path)}`, {
      method: 'PUT',
      body: JSON.stringify(doc),
    }),
  deleteCanvas: (vaultId: string, path: string) =>
    request<void>(`/vaults/${vaultId}/canvas/${encodeSegments(path)}`, { method: 'DELETE' }),

  // Activity
  listActivity: (vaultId: string, limit = 200) =>
    request<ActivityEntry[]>(`/vaults/${vaultId}/activity?limit=${limit}`),

  // Templates
  listTemplates: (vaultId: string) => request<TemplateSummary[]>(`/vaults/${vaultId}/templates`),
  createTemplate: (vaultId: string, name: string, path: string, content: string) =>
    request<TemplateSummary>(`/vaults/${vaultId}/templates`, {
      method: 'POST',
      body: JSON.stringify({ name, path, content }),
    }),
  deleteTemplate: (vaultId: string, templateId: string) =>
    request<void>(`/vaults/${vaultId}/templates/${templateId}`, { method: 'DELETE' }),
  applyTemplate: (vaultId: string, templateId: string, title: string) =>
    request<{ content: string }>(
      `/vaults/${vaultId}/templates/${templateId}/apply?title=${encodeURIComponent(title)}`,
      { method: 'POST' },
    ),

  // Daily notes
  openDailyNote: (vaultId: string, opts?: { folder?: string; date_format?: string; template_path?: string }) =>
    request<{ path: string; created: boolean }>(`/vaults/${vaultId}/daily-note`, {
      method: 'POST',
      body: JSON.stringify(opts ?? {}),
    }),

  // Settings
  getSettings: (vaultId: string) => request<{ data: Record<string, unknown> }>(`/vaults/${vaultId}/settings`),
  updateSettings: (vaultId: string, data: Record<string, unknown>) =>
    request<{ data: Record<string, unknown> }>(`/vaults/${vaultId}/settings`, {
      method: 'PUT',
      body: JSON.stringify({ data }),
    }),

  // Plugins
  listPlugins: (vaultId: string) => request<PluginInfo[]>(`/vaults/${vaultId}/plugins`),
  togglePlugin: (vaultId: string, pluginId: string, enabled: boolean) =>
    request<{ id: string; enabled: boolean }>(`/vaults/${vaultId}/plugins/${pluginId}/toggle?enabled=${enabled}`, {
      method: 'POST',
    }),

  // Import / export
  exportVault: (vaultId: string) => request<Blob>(`/vaults/${vaultId}/export`),
  importVault: (vaultId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<{ imported_files: string[]; count: number }>(`/vaults/${vaultId}/import`, {
      method: 'POST',
      body: form,
    })
  },

  // AI Agent
  getAIConfig: (vaultId: string) => request<AIConfig>(`/vaults/${vaultId}/ai/config`),
  setAIConfig: (vaultId: string, patch: { api_key?: string; provider?: string; model?: string; auto_approve_safe?: boolean }) =>
    request<AIConfig>(`/vaults/${vaultId}/ai/config`, { method: 'PUT', body: JSON.stringify(patch) }),
  listAIActions: (vaultId: string, limit = 50) => request<AIAction[]>(`/vaults/${vaultId}/ai/actions?limit=${limit}`),
  aiContextPreview: (vaultId: string, context: AIContextSelection) =>
    request<AIContextPreview>(`/vaults/${vaultId}/ai/context/preview`, { method: 'POST', body: JSON.stringify(context) }),

  // Obsidian Local REST API connector (Mode B)
  getObsidianRestConfig: (vaultId: string) => request<ObsidianConnectionConfig>(`/vaults/${vaultId}/obsidian-rest/config`),
  setObsidianRestConfig: (
    vaultId: string,
    patch: { host?: string; port?: number; api_key?: string; use_https?: boolean; verify_ssl?: boolean },
  ) => request<ObsidianConnectionConfig>(`/vaults/${vaultId}/obsidian-rest/config`, { method: 'PUT', body: JSON.stringify(patch) }),
  testObsidianRestConnection: (vaultId: string) =>
    request<ObsidianTestResult>(`/vaults/${vaultId}/obsidian-rest/test`, { method: 'POST' }),
}

/** One increment of a streamed agent turn, mirroring the backend's SSE event shapes. */
export type AIStreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_result'; tool_name: string; tool_input: Record<string, unknown>; result: unknown }
  | { type: 'pending_confirmation'; action_id: string; tool_name: string; tool_input: Record<string, unknown>; safety: string }
  | { type: 'done' }
  | { type: 'error'; error: string }

async function streamSSE(path: string, body: unknown, onEvent: (event: AIStreamEvent) => void, signal?: AbortSignal): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      detail = (await res.json()).detail ?? detail
    } catch {
      // ignore
    }
    onEvent({ type: 'error', error: detail })
    return
  }
  const reader = res.body?.getReader()
  if (!reader) return
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''
    for (const chunk of chunks) {
      const line = chunk.split('\n').find((l) => l.startsWith('data: '))
      if (!line) continue
      try {
        onEvent(JSON.parse(line.slice('data: '.length)))
      } catch {
        // ignore malformed chunk
      }
    }
  }
}

export function streamAIChat(vaultId: string, conversationId: string, message: string, context: AIContextSelection | null, onEvent: (e: AIStreamEvent) => void, signal?: AbortSignal) {
  return streamSSE(`/vaults/${vaultId}/ai/chat`, { conversation_id: conversationId, message, context }, onEvent, signal)
}

export function streamAIConfirm(vaultId: string, conversationId: string, approved: boolean, onEvent: (e: AIStreamEvent) => void, signal?: AbortSignal) {
  return streamSSE(`/vaults/${vaultId}/ai/confirm`, { conversation_id: conversationId, approved }, onEvent, signal)
}

function encodeSegments(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

export { ApiError }
