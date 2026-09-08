import { describe, expect, it } from 'vitest'
import { evaluateLine } from './evaluate'

function n(text: string): number {
  const r = evaluateLine(text)
  if (r.value == null || !Number.isFinite(r.value.n)) {
    throw new Error(`No numeric result for ${JSON.stringify(text)} → ${r.display} ${r.error ?? ''}`)
  }
  return r.value.n
}

function closeTo(actual: number, expected: number, eps = 1e-9): void {
  expect(Math.abs(actual - expected)).toBeLessThan(eps)
}

describe('calculator benchmark', () => {
  it('evaluates arithmetic as you type', () => {
    closeTo(n('2+2'), 4)
    closeTo(n('10-3'), 7)
    closeTo(n('7*8'), 56)
    closeTo(n('9/3'), 3)
    closeTo(n('2^8'), 256)
    closeTo(n('(1+2)*3'), 9)
    closeTo(n('1/3'), 1 / 3)
    closeTo(n('-3+5'), 2)
    closeTo(n('100/8'), 12.5)
  })

  it('handles scientific notation and 10^-n', () => {
    closeTo(n('10^-3'), 0.001)
    closeTo(n('3.13*0.3*10^-3'), 0.000939)
    closeTo(n('3.13 * 0.3 * 10^-3'), 0.000939)
    closeTo(n('3.13*0.3*1e-3'), 0.000939)
    closeTo(n('1.5e-4'), 0.00015)
    closeTo(n('2.5E6'), 2_500_000)
    closeTo(n('6.02*10^23'), 6.02e23, 1e16)
    closeTo(n('1/10^-3'), 1000)
    closeTo(n('5*10^-2 + 3*10^-2'), 0.08)
  })

  it('handles nested ops and unary minus', () => {
    closeTo(n('-(2+3)*4'), -20)
    closeTo(n('2^-3'), 0.125)
    closeTo(n('3.13*0.3*(10^-3)'), 0.000939)
    closeTo(n('sqrt(16)'), 4)
    closeTo(n('abs(-12.5)'), 12.5)
  })

  it('shows live intermediate expressions without throwing', () => {
    expect(() => evaluateLine('3.13*')).not.toThrow()
    expect(n('3.13*0.3')).toBeCloseTo(0.939)
    expect(n('3.13*0.3*10')).toBeCloseTo(9.39)
    expect(() => evaluateLine('3.13*0.3*10^')).not.toThrow()
    closeTo(n('3.13*0.3*10^-3'), 0.000939)
  })

  it('formats the headline example', () => {
    const r = evaluateLine('3.13*0.3*10^-3')
    expect(r.kind).toBe('expression')
    expect(r.display).toMatch(/0\.000939/)
  })
})
