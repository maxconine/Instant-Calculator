import { describe, expect, it } from 'vitest'
import {
  clampDraftSeconds,
  DEFAULT_DRAFT_SECONDS,
  hideAction,
  shouldRestoreDraft,
} from './draft'

describe('hideAction', () => {
  it('commits a valid expression', () => {
    expect(hideAction('2+2', '4', 60)).toBe('commit')
  })

  it('keeps unfinished input when retention is on', () => {
    expect(hideAction('sin(', '', 60)).toBe('keep')
  })

  it('clears unfinished input when retention is off', () => {
    expect(hideAction('sin(', '', 0)).toBe('clear')
  })

  it('does not commit an improper unit conversion', () => {
    expect(hideAction('10 m to kg', 'improper unit conversion', 60)).toBe('keep')
    expect(hideAction('10 m to kg', 'improper unit conversion', 0)).toBe('clear')
  })

  it('clears an empty field', () => {
    expect(hideAction('  ', '', 60)).toBe('clear')
    expect(hideAction('', '4', 60)).toBe('clear')
  })
})

describe('shouldRestoreDraft', () => {
  it('restores within the retention window', () => {
    expect(shouldRestoreDraft(1_000, 1_000 + 59_000, 60)).toBe(true)
  })

  it('expires after the retention window', () => {
    expect(shouldRestoreDraft(1_000, 1_000 + 60_000, 60)).toBe(false)
  })

  it('does not restore when retention is off', () => {
    expect(shouldRestoreDraft(1_000, 1_001, 0)).toBe(false)
  })
})

describe('clampDraftSeconds', () => {
  it('defaults invalid values to one minute', () => {
    expect(clampDraftSeconds(Number.NaN)).toBe(DEFAULT_DRAFT_SECONDS)
    expect(clampDraftSeconds(-1)).toBe(DEFAULT_DRAFT_SECONDS)
  })

  it('allows off and caps the upper bound', () => {
    expect(clampDraftSeconds(0)).toBe(0)
    expect(clampDraftSeconds(9_999)).toBe(3600)
  })
})
