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

  it.each(
    [
      ['1+2+3+4', 10],
      ['100-1-1-1', 97],
      ['2*3*4', 24],
      ['81/3/3', 9],
      ['2^(3^2)', 512],
      ['(2^3)^2', 64],
      ['-5+12', 7],
      ['5+-2', 3],
      ['10^-2', 0.01],
      ['10^-4', 0.0001],
      ['1.5e2', 150],
      ['2.5E-3', 0.0025],
      ['3.0*10^4', 30000],
      ['4*10^-2', 0.04],
      ['sqrt(25)', 5],
      ['sqrt(0.25)', 0.5],
      ['abs(-3.14)', 3.14],
      ['-(4+6)', -10],
      ['(-4+6)*2', 4],
      ['1/2*4', 2],
      ['8/2/2', 2],
      ['3.13*0.2', 0.626],
      ['3.13+0.3', 3.43],
      ['3.13-0.3', 2.83],
      ['3.13/0.3', 3.13 / 0.3],
      ['2^0', 1],
      ['2^-1', 0.5],
      ['2^-2', 0.25],
      ['9^(1/2)', 3],
      ['27^(1/3)', 3],
      ['1e-3*1e3', 1],
      ['6.02e2', 602],
      ['7/8', 0.875],
      ['0.1*0.1', 0.01],
      ['100*0.13', 13],
      ['-(2^3)', -8],
      ['2*(3+4+5)', 24],
      ['((2))', 2],
      ['1+2*3+4', 11],
      ['(1+2)*(3+4)', 21],
      ['12.5/2.5', 5],
      ['0+0', 0],
      ['1-1', 0],
      ['9*0', 0],
      ['5^1', 5],
      ['5^2', 25],
      ['5^3', 125],
      ['1.25e1', 12.5],
      ['8.15*10^0', 8.15],
      ['3.13*0.3*10^-2', 0.00939],
      ['3.13*0.3*10^-1', 0.0939],
      ['3.13*0.3*10^0', 0.939],
      ['3.13*0.3*10^1', 9.39],
      ['3.13*0.3*10^2', 93.9],
      ['10^0', 1],
      ['10^1', 10],
      ['10^2', 100],
      ['10^-1', 0.1],
      ['1/10^-2', 100],
      ['1/10^-4', 10000],
      ['2.5*10^-1 + 2.5*10^-1', 0.5],
      ['sqrt(81)', 9],
      ['sqrt(100)', 10],
      ['abs(-0.5)', 0.5],
      ['abs(0)', 0],
      ['-(-7)', 7],
      ['-(-(-3))', -3],
      ['4*(5-2)', 12],
      ['100/4/5', 5],
      ['2^8-1', 255],
      ['2^10+24', 1048],
      ['1.5e-3*2', 0.003],
      ['9.9e1', 99],
      ['0.25*0.25', 0.0625],
      ['16/0.5', 32],
      ['0.5/0.25', 2],
      ['3+3*3-3', 9],
      ['(3+3)*(3-3)', 0],
      ['2^2*2^2', 16],
      ['1000*10^-3', 1],
      ['7*8+9', 65],
      ['7+8*9', 79],
      ['(7+8)*9', 135],
      ['1.25*4', 5],
      ['-10+25', 15],
      ['25-40', -15],
      ['6/3*2', 4],
      ['6*3/2', 9],
      ['2^(2+3)', 32],
      ['(10^-1)^2', 0.01],
      ['sqrt(2)*sqrt(2)', 2],
      ['abs(-12)+abs(12)', 24],
      ['3.13*1', 3.13],
      ['3.13*0', 0],
      ['1e6 / 1e3', 1000],
      ['2.5E2 + 2.5E2', 500],
    ] as Array<[string, number]>,
  )('extra %s', (expr, expected) => {
    closeTo(n(expr), expected, Math.max(1e-9, Math.abs(expected) * 1e-9))
  })
})
