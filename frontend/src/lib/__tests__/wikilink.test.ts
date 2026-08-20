import { describe, expect, it } from 'vitest'
import { transformWikilinks, isWikilinkHref, targetFromHref, WIKILINK_SCHEME } from '@/lib/wikilink'

describe('transformWikilinks', () => {
  it('converts a plain wikilink into a markdown link with the wikilink scheme', () => {
    const out = transformWikilinks('See [[Machine Learning]] for more.')
    expect(out).toBe('See [Machine Learning](wikilink://Machine%20Learning) for more.')
  })

  it('uses the alias as display text when present', () => {
    const out = transformWikilinks('[[Machine Learning|ML]]')
    expect(out).toContain('[ML](wikilink://Machine%20Learning)')
  })

  it('encodes a heading fragment when present', () => {
    const out = transformWikilinks('[[Note#Section|Alias]]')
    expect(out).toContain('wikilink://Note%23Section')
  })

  it('leaves wikilink-looking text inside fenced code blocks untouched', () => {
    const out = transformWikilinks('```\n[[Not A Link]]\n```')
    expect(out).toBe('```\n[[Not A Link]]\n```')
  })

  it('leaves wikilink-looking text inside inline code untouched', () => {
    const out = transformWikilinks('Use `[[Target]]` syntax.')
    expect(out).toBe('Use `[[Target]]` syntax.')
  })

  it('handles multiple wikilinks in the same text', () => {
    const out = transformWikilinks('[[A]] and [[B]]')
    expect(out).toBe('[A](wikilink://A) and [B](wikilink://B)')
  })

  it('resolves a block reference to a normal link on the note', () => {
    const out = transformWikilinks('[[Note^abc123]]')
    expect(out).toBe('[Note](wikilink://Note)')
  })

  it('resolves a heading + block reference, keeping the alias', () => {
    const out = transformWikilinks('[[Note#Heading^abc123|Alias]]')
    expect(out).toContain('[Alias](wikilink://Note%23Heading)')
  })

  it('renders an image embed as a real markdown image against the files base URL', () => {
    const out = transformWikilinks('![[diagram.png]]', '/api/vaults/v1/files')
    expect(out).toBe('![diagram.png](/api/vaults/v1/files/diagram.png)')
  })

  it('falls back to a plain link for an image embed with no files base URL', () => {
    const out = transformWikilinks('![[diagram.png]]')
    expect(out).toContain('[diagram.png](wikilink://diagram.png)')
  })

  it('treats a note transclusion embed as a normal link, not an image', () => {
    const out = transformWikilinks('![[Some Note]]', '/api/vaults/v1/files')
    expect(out).toBe('[Some Note](wikilink://Some%20Note)')
  })

  it('encodes nested attachment folder paths in the image URL', () => {
    const out = transformWikilinks('![[Attachments/diagram.png]]', '/api/vaults/v1/files')
    expect(out).toBe('![Attachments/diagram.png](/api/vaults/v1/files/Attachments/diagram.png)')
  })
})

describe('isWikilinkHref / targetFromHref', () => {
  it('identifies a wikilink href', () => {
    expect(isWikilinkHref(`${WIKILINK_SCHEME}Foo`)).toBe(true)
    expect(isWikilinkHref('https://example.com')).toBe(false)
    expect(isWikilinkHref(undefined)).toBe(false)
  })

  it('extracts and decodes the target, dropping any heading fragment', () => {
    expect(targetFromHref(`${WIKILINK_SCHEME}${encodeURIComponent('Machine Learning')}`)).toBe('Machine Learning')
    expect(targetFromHref(`${WIKILINK_SCHEME}Note%23Section`)).toBe('Note')
  })
})
