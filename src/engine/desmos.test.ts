import { describe, expect, it } from 'vitest'
import { evaluateLine, evaluateSheet } from './evaluate'
import { latexToAscii, tryPlainMath } from './plainMath'

function n(text: string, angleMode: 'deg' | 'rad' = 'deg'): number {
  const r = evaluateLine(text, { angleMode })
  if (r.value == null || !Number.isFinite(r.value.n)) {
    throw new Error(`No numeric result for ${JSON.stringify(text)} → ${r.display} ${r.error ?? ''}`)
  }
  return r.value.n
}

function closeTo(actual: number, expected: number, eps = 1e-8): void {
  expect(Math.abs(actual - expected)).toBeLessThan(eps)
}

describe('Desmos scientific', () => {
  it('roots, powers, and fractions', () => {
    closeTo(n('sqrt(16)'), 4)
    closeTo(n('cbrt(27)'), 3)
    closeTo(n('nthroot(81, 4)'), 3)
    closeTo(n('2^8'), 256)
    closeTo(n('10^-3'), 0.001)
    closeTo(n('\\sqrt{16}+2^{3}'), 12)
    closeTo(n('\\sqrt[3]{8}'), 2)
    closeTo(n('\\frac{1}{2}+\\frac{1}{3}'), 5 / 6)
  })

  it('trig in degrees by default', () => {
    closeTo(n('sin(90)'), 1)
    closeTo(n('cos(0)'), 1)
    closeTo(n('tan(45)'), 1)
    closeTo(n('arcsin(1)'), 90)
    closeTo(n('csc(90)'), 1)
    closeTo(n('\\sin\\left(90\\right)'), 1)
  })

  it('trig in radians when asked', () => {
    closeTo(n('sin(pi/2)', 'rad'), 1)
    closeTo(n('cos(0)', 'rad'), 1)
    closeTo(n('arcsin(1)', 'rad'), Math.PI / 2)
  })

  it('logs, exp, factorial, combinatorics', () => {
    closeTo(n('ln(e)'), 1)
    closeTo(n('log(100)'), 2)
    closeTo(n('log_2(8)'), 3)
    closeTo(n('\\ln\\left(e\\right)'), 1)
    closeTo(n('\\log\\left(1000\\right)'), 3)
    closeTo(n('5!'), 120)
    closeTo(n('nCr(6,2)'), 15)
    closeTo(n('nPr(6,2)'), 30)
    closeTo(n('\\operatorname{nCr}\\left(6,2\\right)'), 15)
  })

  it('stats, abs, floor, complex pieces', () => {
    closeTo(n('abs(-12.5)'), 12.5)
    closeTo(n('\\left|-3\\right|'), 3)
    closeTo(n('mean(1,5,5,10)'), 5.25)
    closeTo(n('stdevp(1,5,5,10)'), Math.sqrt(10.1875))
    closeTo(n('floor(3.9)'), 3)
    closeTo(n('ceil(3.1)'), 4)
    closeTo(n('round(3.5)'), 4)
    closeTo(n('re(2+3i)'), 2)
    closeTo(n('im(2+3i)'), 3)
  })

  it('ans is the previous numeric result', () => {
    const r = evaluateSheet(['2+3', 'ans*4'])
    closeTo(r[0].value!.n, 5)
    closeTo(r[1].value!.n, 20)
  })

  it('ans can be supplied for a single line', () => {
    const r = evaluateLine('ans+1', { angleMode: 'deg', ans: 9 })
    expect(r.value?.n).toBe(10)
  })

  it('converts typeset latex to ascii', () => {
    expect(latexToAscii('\\sqrt{16}+2^{8}')).toContain('sqrt')
    expect(tryPlainMath('\\frac{3}{4}')?.n).toBeCloseTo(0.75)
  })

  it('hyperbolic, gcd, lcm, lists, and binom', () => {
    closeTo(n('sinh(0)'), 0)
    closeTo(n('asinh(0)'), 0)
    closeTo(n('gcd(8,12)'), 4)
    closeTo(n('lcm(4,6)'), 12)
    closeTo(n('n(1,5,5,10)'), 4)
    closeTo(n('length(1,5,5,10)'), 4)
    closeTo(n('total(1,2,3)'), 6)
    closeTo(n('median(1,2,3,4,5)'), 3)
    closeTo(n('quartile(1,2,3,4,5,2)'), 3)
    closeTo(n('\\binom{6}{2}'), 15)
    closeTo(n('\\operatorname{gcd}\\left(8,12\\right)'), 4)
  })

  it('random returns a finite number', () => {
    const r = n('random()')
    expect(r).toBeGreaterThanOrEqual(0)
    expect(r).toBeLessThan(1)
  })
})
