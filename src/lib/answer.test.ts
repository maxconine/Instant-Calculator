import { describe, expect, it } from 'vitest'
import { insertableAnswer, insertableHistoryAnswer } from './answer'

describe('insertableAnswer', () => {
  it('keeps units from the displayed answer', () => {
    expect(insertableAnswer('1.2 m', 1.2)).toBe('1.2 m')
    expect(insertableAnswer('50.8 mm', 50.8)).toBe('50.8 mm')
    expect(insertableAnswer('0.0508 m', 0.0508)).toBe('0.0508 m')
    expect(insertableAnswer('1,200 m', 1200)).toBe('1200 m')
    expect(insertableAnswer('4320000 J', 4.32e6)).toBe('4320000 J')
    expect(insertableAnswer('96.56 km/h', 96.56064)).toBe('96.56 km/h')
  })

  it('keeps currency, times, and fractions from the displayed answer', () => {
    expect(insertableAnswer('$11.50', 11.5)).toBe('$11.50')
    expect(insertableAnswer('7:55 pm')).toBe('7:55 pm')
    expect(insertableAnswer('5/8', 0.625)).toBe('5/8')
  })

  it('uses the numeric value when the display is only a number', () => {
    expect(insertableAnswer('4', 4)).toBe('4')
    expect(insertableAnswer('1,200', 1200)).toBe('1200')
    expect(insertableAnswer('3.14159265359', Math.PI)).toBe(String(Math.PI))
    expect(insertableAnswer('2.46e-11', 2.46e-11)).toBe((2.46e-11).toExponential())
  })

  it('does not insert an improper unit conversion', () => {
    expect(insertableAnswer('improper unit conversion')).toBe('')
  })

  it('falls back to the display when there is no finite number', () => {
    expect(insertableAnswer('∞')).toBe('∞')
    expect(insertableAnswer('[1, 2, 3]')).toBe('[1, 2, 3]')
  })

  it('inserts an exact radical or fraction instead of the decimal', () => {
    expect(insertableAnswer('2sqrt(3)', Math.sqrt(12))).toBe('2sqrt(3)')
    expect(insertableAnswer('1/2', 0.5)).toBe('1/2')
    expect(insertableAnswer('pi/6', Math.PI / 6)).toBe('pi/6')
  })
})

describe('insertableHistoryAnswer', () => {
  const cosPiOver6 = {
    display: '0.866025403784',
    exact: 'sqrt(3)/2',
    n: Math.sqrt(3) / 2,
  }

  it('inserts the exact form when that setting is on', () => {
    expect(insertableHistoryAnswer(cosPiOver6, 'exact')).toBe('sqrt(3)/2')
    expect(insertableHistoryAnswer({ display: '3.46410161514', exact: '2sqrt(3)', n: Math.sqrt(12) }, 'exact')).toBe(
      '2sqrt(3)',
    )
  })

  it('inserts the approximation when approx is on', () => {
    expect(insertableHistoryAnswer(cosPiOver6, 'approx')).toBe(String(Math.sqrt(3) / 2))
    expect(insertableHistoryAnswer(cosPiOver6, 'approx')).not.toMatch(/sqrt/)
  })

  it('falls back to the approximation when there is no exact form', () => {
    expect(insertableHistoryAnswer({ display: '4', n: 4 }, 'exact')).toBe('4')
    expect(insertableHistoryAnswer({ display: '4', n: 4 }, 'approx')).toBe('4')
  })
})
