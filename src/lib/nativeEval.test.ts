import { describe, expect, it } from 'vitest'
import {
  looksLikeNaturalLanguage,
  mergeLiveAnswer,
  nativeEvalPayload,
  nativeReplyToLive,
  usableNativeDisplay,
} from './nativeEval'

describe('mergeLiveAnswer', () => {
  it('prefers the JS engine for ordinary arithmetic', () => {
    expect(mergeLiveAnswer('2+2', '4', 4, { expr: '2+2', display: '4.00', n: 4 })).toEqual({
      display: '4',
      n: 4,
    })
  })

  it('prefers SoulverCore for natural-language phrases even if JS also answered', () => {
    expect(
      mergeLiveAnswer('what is 40% of 90', '36', 36, {
        expr: 'what is 40% of 90',
        display: '36',
        n: 36,
      }),
    ).toEqual({ display: '36', n: 36 })
  })

  it('keeps the JS engine for unit products even if SoulverCore also answered', () => {
    expect(
      mergeLiveAnswer('50 W * 1 day', '4320000 J', 4.32e6, {
        expr: '50 W * 1 day',
        display: '1.2 kWh',
        n: 1.2,
      }),
    ).toEqual({ display: '4320000 J', n: 4.32e6 })
  })

  it('uses SoulverCore when the JS engine has no result', () => {
    expect(
      mergeLiveAnswer('$10 for lunch + 15% tip', '', undefined, {
        expr: '$10 for lunch + 15% tip',
        display: '$11.50',
        n: 11.5,
      }),
    ).toEqual({ display: '$11.50', n: 11.5 })
  })

  it('ignores a stale SoulverCore answer for a different expression', () => {
    expect(mergeLiveAnswer('2 in to cm', '', undefined, { expr: '65 kg in lb', display: '143.3 lb', n: 143.3 })).toEqual(
      { display: '' },
    )
  })

  it('shows a unit conversion failure from SoulverCore', () => {
    expect(
      mergeLiveAnswer('10 meters to kilograms', '', undefined, {
        expr: '10 meters to kilograms',
        display: 'Error: incompatible units',
      }),
    ).toEqual({ display: 'improper unit conversion' })
  })

  it('clears the answer when the field is empty', () => {
    expect(mergeLiveAnswer('  ', '', undefined, { expr: '2+2', display: '4', n: 4 })).toEqual({ display: '' })
  })
})

describe('nativeReplyToLive', () => {
  it('accepts a matching reply', () => {
    expect(
      nativeReplyToLive({ id: 3, expr: '3:45pm + 4 hr', display: '7:55 pm', n: null }, 3, '3:45pm + 4 hr'),
    ).toEqual({
      expr: '3:45pm + 4 hr',
      display: '7:55 pm',
    })
  })

  it('drops stale or empty replies', () => {
    expect(nativeReplyToLive({ id: 1, expr: '2+2', display: '4', n: 4 }, 2, '2+2')).toBeNull()
    expect(nativeReplyToLive({ id: 1, expr: '2+2', display: '4', n: 4 }, 1, '2+3')).toBeNull()
    expect(nativeReplyToLive({ id: 1, expr: '2+2', display: '  ', n: 4 }, 1, '2+2')).toBeNull()
  })

  it('maps SoulverCore incompatible units to a friendly message', () => {
    expect(
      nativeReplyToLive(
        { id: 1, expr: '10 meters to kilograms', display: 'Error: incompatible units', n: null },
        1,
        '10 meters to kilograms',
      ),
    ).toEqual({
      expr: '10 meters to kilograms',
      display: 'improper unit conversion',
    })
    expect(
      nativeReplyToLive({ id: 1, expr: '10^1000 m to nm', display: 'Error: ∞', n: null }, 1, '10^1000 m to nm'),
    ).toBeNull()
  })
})

describe('usableNativeDisplay', () => {
  it('maps incompatible-unit engine errors and rejects other errors', () => {
    expect(usableNativeDisplay('Error: incompatible units')).toBe('improper unit conversion')
    expect(usableNativeDisplay('improper unit conversion')).toBe('improper unit conversion')
    expect(usableNativeDisplay('error: divide by zero')).toBe('')
    expect(usableNativeDisplay('  Error: ∞/m  ')).toBe('')
    expect(usableNativeDisplay('25.4 cm')).toBe('25.4 cm')
  })
})

describe('looksLikeNaturalLanguage', () => {
  it('detects Soulver-style phrases', () => {
    expect(looksLikeNaturalLanguage('what is 40% of 90')).toBe(true)
    expect(looksLikeNaturalLanguage('$10 for lunch + 15% tip')).toBe(true)
    expect(looksLikeNaturalLanguage('3:45pm + 4 hr 10 min')).toBe(true)
  })

  it('leaves scientific calculator input to the JS engine', () => {
    expect(looksLikeNaturalLanguage('sin(90)')).toBe(false)
    expect(looksLikeNaturalLanguage('2+2')).toBe(false)
    expect(looksLikeNaturalLanguage('sqrt(2)')).toBe(false)
    expect(looksLikeNaturalLanguage('50 W * 1 day')).toBe(false)
    expect(looksLikeNaturalLanguage('1 Therm / 1 day')).toBe(false)
    expect(looksLikeNaturalLanguage('20 m * 2 in')).toBe(false)
    expect(looksLikeNaturalLanguage('1 kW * 2 hr')).toBe(false)
  })
})

describe('nativeEvalPayload', () => {
  it('omits undefined ans so WKWebView can serialize the message', () => {
    const payload = nativeEvalPayload({ id: 1, expr: 'what is 40% of 90', ans: undefined, sigFigs: 12 })
    expect(payload).toEqual({ type: 'eval', id: 1, expr: 'what is 40% of 90', sigFigs: 12 })
    expect(Object.values(payload).some((v) => v === undefined)).toBe(false)
  })

  it('includes a finite previous answer', () => {
    expect(nativeEvalPayload({ id: 2, expr: 'ans + 1', ans: 36, sigFigs: 12 }).ans).toBe(36)
  })
})
