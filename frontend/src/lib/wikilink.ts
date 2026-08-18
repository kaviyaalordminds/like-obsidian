const WIKILINK_RE = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g
const CODE_FENCE_RE = /```[\s\S]*?```|`[^`\n]*`/g

export const WIKILINK_SCHEME = 'wikilink://'

/** Rewrites [[Target]] / [[Target|Alias]] / [[Folder/Target#Heading|Alias]]
 * into standard Markdown links with a custom scheme so react-markdown can
 * render them, while leaving fenced/inline code untouched. */
export function transformWikilinks(markdown: string): string {
  const codeRanges: [number, number][] = []
  let m: RegExpExecArray | null
  const codeRe = new RegExp(CODE_FENCE_RE)
  while ((m = codeRe.exec(markdown))) {
    codeRanges.push([m.index, m.index + m[0].length])
  }
  const inCode = (idx: number) => codeRanges.some(([s, e]) => idx >= s && idx < e)

  return markdown.replace(WIKILINK_RE, (full, target: string, heading: string | undefined, alias: string | undefined, offset: number) => {
    if (inCode(offset)) return full
    const display = alias?.trim() || target.trim()
    const href = `${WIKILINK_SCHEME}${encodeURIComponent(target.trim())}${heading ? '%23' + encodeURIComponent(heading.trim()) : ''}`
    return `[${display}](${href})`
  })
}

export function isWikilinkHref(href: string | undefined): boolean {
  return !!href && href.startsWith(WIKILINK_SCHEME)
}

export function targetFromHref(href: string): string {
  const raw = decodeURIComponent(href.slice(WIKILINK_SCHEME.length))
  return raw.split('#')[0]
}
