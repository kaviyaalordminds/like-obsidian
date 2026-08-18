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
