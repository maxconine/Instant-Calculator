import { describe, expect, it } from 'vitest'
import { evaluateLine } from './evaluate'
import { formatNumber } from './format'

describe('significant figures', () => {
  it('rounds π to the requested significant figures', () => {
    expect(formatNumber(Math.PI, 4)).toBe('3.142')
    expect(formatNumber(Math.PI, 6)).toBe('3.14159')
  })

  it('keeps small exact decimals like unit conversions', () => {
    expect(formatNumber(50.8, 12)).toBe('50.8')
    expect(formatNumber(0.0508, 12)).toBe('0.0508')
  })

  it('does not throw on extreme magnitudes', () => {
    expect(() => formatNumber(1e-320, 12)).not.toThrow()
    expect(() => formatNumber(1e308, 12)).not.toThrow()
    expect(() => formatNumber(Number.NaN, 12)).not.toThrow()
    expect(() => formatNumber(Number.POSITIVE_INFINITY, 12)).not.toThrow()
  })

  it('applies significant figures to live results', () => {
    expect(evaluateLine('pi', { sigFigs: 4 }).display).toBe('3.142')
    expect(evaluateLine('2 in', { sigFigs: 3 }).display).toBe('50.8 mm')
  })
})
