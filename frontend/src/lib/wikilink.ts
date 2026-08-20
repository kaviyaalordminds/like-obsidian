const WIKILINK_RE = /(!)?\[\[([^\]|#^]+)(?:#([^\]|^]+))?(?:\^([^\]|]+))?(?:\|([^\]]+))?\]\]/g
const CODE_FENCE_RE = /```[\s\S]*?```|`[^`\n]*`/g

export const WIKILINK_SCHEME = 'wikilink://'

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp']

function isImageTarget(target: string): boolean {
  const lower = target.toLowerCase()
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

/** Rewrites [[Target]] / [[Target|Alias]] / [[Folder/Target#Heading|Alias]]
 * / [[Target^Block]] into standard Markdown links with a custom scheme so
 * react-markdown can render them (block refs resolve to the note; the
 * specific block anchor isn't scrolled to yet), while leaving fenced/inline
 * code untouched. `![[image.png]]` becomes a real Markdown image pointing
 * at the vault's file-serving endpoint; `![[Some Note]]` (a note
 * transclusion, not an attachment) becomes a normal link to that note —
 * full inline transclusion is a future extension. */
export function transformWikilinks(markdown: string, vaultFilesBaseUrl?: string): string {
  const codeRanges: [number, number][] = []
  let m: RegExpExecArray | null
  const codeRe = new RegExp(CODE_FENCE_RE)
  while ((m = codeRe.exec(markdown))) {
    codeRanges.push([m.index, m.index + m[0].length])
  }
  const inCode = (idx: number) => codeRanges.some(([s, e]) => idx >= s && idx < e)

  return markdown.replace(
    WIKILINK_RE,
    (full, bang: string | undefined, target: string, heading: string | undefined, _block: string | undefined, alias: string | undefined, offset: number) => {
      if (inCode(offset)) return full
      const trimmedTarget = target.trim()
      const display = alias?.trim() || trimmedTarget

      if (bang && isImageTarget(trimmedTarget) && vaultFilesBaseUrl) {
        const url = `${vaultFilesBaseUrl}/${trimmedTarget.split('/').map(encodeURIComponent).join('/')}`
        return `![${display}](${url})`
      }

      const href = `${WIKILINK_SCHEME}${encodeURIComponent(trimmedTarget)}${heading ? '%23' + encodeURIComponent(heading.trim()) : ''}`
      return `[${display}](${href})`
    },
  )
}

export function isWikilinkHref(href: string | undefined): boolean {
  return !!href && href.startsWith(WIKILINK_SCHEME)
}

export function targetFromHref(href: string): string {
  const raw = decodeURIComponent(href.slice(WIKILINK_SCHEME.length))
  return raw.split('#')[0]
}
