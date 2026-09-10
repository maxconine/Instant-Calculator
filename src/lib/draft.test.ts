import { describe, expect, it } from 'vitest'
import {
  clampDraftSeconds,
  DEFAULT_DRAFT_SECONDS,
  hideAction,
  shouldRestoreDraft,
} from './draft'

describe('hideAction', () => {
  it('keeps a valid expression when retention is on', () => {
    expect(hideAction('2+2', '4', 60)).toBe('keep')
  })

  it('keeps inferred-paren input when retention is on', () => {
    expect(hideAction('sin(90', '1', 60)).toBe('keep')
    expect(hideAction('log(2', '0.30103', 60)).toBe('keep')
  })

  it('commits a valid expression when retention is off', () => {
    expect(hideAction('2+2', '4', 0)).toBe('commit')
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

describe('hideAction', () => {
  const exprs = ['2+2', 'sin(90)', 'sqrt(2)', '10 m to cm', '3.13*0.3', '1+2+3', 'pi', '5!', 'log(100)', '2 in']
  it.each(exprs)('keeps %s when retention on', (expr) => {
    expect(hideAction(expr, '1', 60)).toBe('keep')
  })
  it.each(exprs)('commits %s when retention off and display set', (expr) => {
    expect(hideAction(expr, '1', 0)).toBe('commit')
  })
  it.each(exprs)('clears unfinished %s( when retention off', (expr) => {
    expect(hideAction(`${expr}(`, '', 0)).toBe('clear')
  })
  it.each(exprs)('keeps unfinished %s( when retention on', (expr) => {
    expect(hideAction(`${expr}(`, '', 30)).toBe('keep')
  })
  it.each([1, 5, 10, 15, 30, 45, 60, 120, 300, 600, 1800, 3600])('keeps valid input at %i seconds', (s) => {
    expect(hideAction('2+2', '4', s)).toBe('keep')
  })
  it.each(['', ' ', '   ', '\t', '\n'])('clears blank %j', (expr) => {
    expect(hideAction(expr, '4', 60)).toBe('clear')
  })
  it.each([0, 1, 60])('improper conversion at %i seconds', (s) => {
    expect(hideAction('10 m to kg', 'improper unit conversion', s)).toBe(s > 0 ? 'keep' : 'clear')
  })
  it.each(Array.from({ length: 40 }, (_, i) => `expr${i}`))('keeps %s with display', (expr) => {
    expect(hideAction(expr, 'ok', 10)).toBe('keep')
    expect(hideAction(expr, 'ok', 0)).toBe('commit')
    expect(hideAction(expr, '', 0)).toBe('clear')
  })
})

describe('shouldRestoreDraft', () => {
  it.each(Array.from({ length: 50 }, (_, i) => i))('restores at %i seconds elapsed of 60', (elapsed) => {
    expect(shouldRestoreDraft(1000, 1000 + elapsed * 1000, 60)).toBe(elapsed < 60)
  })
  it.each([0, 1, 2, 5, 10, 30, 59, 60, 61, 120])('window 30s elapsed %i', (elapsed) => {
    expect(shouldRestoreDraft(0, elapsed * 1000, 30)).toBe(false)
    expect(shouldRestoreDraft(1000, 1000 + elapsed * 1000, 30)).toBe(elapsed < 30)
  })
  it.each([0, -1, Number.NaN])('no restore when retention is %s', (s) => {
    expect(shouldRestoreDraft(1, 2, s)).toBe(false)
  })
  it.each(Array.from({ length: 40 }, (_, i) => ({ saved: 10_000, now: 10_000 + i * 500, win: 20 })))(
    'window $win elapsed from $saved to $now',
    ({ saved, now, win }) => {
      expect(shouldRestoreDraft(saved, now, win)).toBe(now - saved < win * 1000)
    },
  )
})

describe('clampDraftSeconds', () => {
  it.each([0, 1, 2, 5, 10, 30, 60, 90, 120, 300, 600, 1800, 3600])('keeps %i', (n) => {
    expect(clampDraftSeconds(n)).toBe(n)
  })
  it.each([-1, -10, Number.NaN, Number.NEGATIVE_INFINITY, -0.5])('defaults invalid %s', (n) => {
    expect(clampDraftSeconds(n)).toBe(DEFAULT_DRAFT_SECONDS)
  })
  it.each([3601, 4000, 9999, 1e6, 1e9])('caps %s', (n) => {
    expect(clampDraftSeconds(n)).toBe(3600)
  })
  it.each([0.4, 0.6, 1.4, 1.6, 59.4, 59.6])('rounds %s', (n) => {
    expect(clampDraftSeconds(n)).toBe(Math.round(n))
  })
  it.each(Array.from({ length: 40 }, (_, i) => i + 100))('midrange %i', (n) => {
    expect(clampDraftSeconds(n)).toBe(n)
  })
  it.each(Array.from({ length: 30 }, (_, i) => i * 10))('tens %i', (n) => {
    const got = clampDraftSeconds(n)
    if (n < 0) expect(got).toBe(DEFAULT_DRAFT_SECONDS)
    else expect(got).toBe(Math.min(3600, n))
  })
})
