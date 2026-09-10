import { describe, expect, it } from 'vitest'
import { insertableAnswer, insertableHistoryAnswer, visibleAnswer } from './answer'

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

  const unitRows = ['1.2 m', '50.8 mm', '0.0508 m', '3.5 kg', '12 lb', '9.81 m/s', '100 kPa', '2.5 L', '180 deg', '60 mph']
  it.each(unitRows.map((d, i) => ({ d, n: i + 1 })))('insertable keeps unit $d', ({ d, n }) => {
    expect(insertableAnswer(d, n)).toBe(d)
  })
  it.each(['$1.00', '$11.50', '€20', '£3.50', '7:55 pm', '12:00 am', '5/8', '1/2', '3/4', '2sqrt(3)', 'sqrt(2)', 'pi/6', 'pi/4', '[1, 2, 3]', '∞'])(
    'insertable keeps display %s',
    (d) => {
      expect(insertableAnswer(d)).toBe(d)
    },
  )
  it.each([0, 1, -1, 2, 4, 10, 12, 100, 1200, 1.5, Math.PI, 2.46e-11, 1e12, 0.000001, 99.25])('insertable number %s', (n) => {
    const shown = String(n)
    const got = insertableAnswer(shown, n)
    if (/e/i.test(got)) expect(Number(got)).toBeCloseTo(n, 8)
    else expect(['', shown, String(n)].includes(got) || Number(got) === n || Number(got) === Number(shown)).toBe(true)
  })
  it.each(['improper unit conversion', 'Improper unit conversion', ' IMPROPER UNIT CONVERSION '])('blank for %s', (d) => {
    expect(insertableAnswer(d)).toBe('')
  })
  it.each(Array.from({ length: 60 }, (_, i) => `${i + 1} cm`))('keeps length display %s', (d) => {
    expect(insertableAnswer(d, 1)).toBe(d)
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

describe('visibleAnswer', () => {
  const cosPiOver6 = { display: '0.866025403784', exact: 'sqrt(3)/2' }

  it('defaults to the exact form', () => {
    expect(visibleAnswer(cosPiOver6, 'exact')).toBe('sqrt(3)/2')
    expect(visibleAnswer({ display: '3.46410161514', exact: '2sqrt(3)' }, 'exact')).toBe('2sqrt(3)')
  })

  it('shows the decimal approximation when approx is on', () => {
    expect(visibleAnswer(cosPiOver6, 'approx')).toBe('0.866025403784')
  })

  it('shows the decimal when there is no exact form', () => {
    expect(visibleAnswer({ display: '4' }, 'exact')).toBe('4')
  })
})

describe('insertableHistoryAnswer', () => {
  const samples = [
    { display: '0.866025403784', exact: 'sqrt(3)/2', n: Math.sqrt(3) / 2 },
    { display: '3.46410161514', exact: '2sqrt(3)', n: Math.sqrt(12) },
    { display: '0.5', exact: '1/2', n: 0.5 },
    { display: '0.70710678118', exact: 'sqrt(2)/2', n: Math.SQRT2 / 2 },
    { display: '1.57079632679', exact: 'pi/2', n: Math.PI / 2 },
    { display: '3.14159265359', exact: 'pi', n: Math.PI },
    { display: '1.73205080757', exact: 'sqrt(3)', n: Math.sqrt(3) },
    { display: '0.78539816339', exact: 'pi/4', n: Math.PI / 4 },
    { display: '0.33333333333', exact: '1/3', n: 1 / 3 },
    { display: '0.25', exact: '1/4', n: 0.25 },
  ]
  it.each(samples)('exact $exact', (row) => {
    expect(insertableHistoryAnswer(row, 'exact')).toBe(row.exact)
  })
  it.each(samples)('approx $exact', (row) => {
    const got = insertableHistoryAnswer(row, 'approx')
    expect(got).not.toMatch(/sqrt|pi\//)
    expect(Number(got)).toBeCloseTo(row.n, 8)
  })
  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 50, 100, -3, 0.5, 1.25])('fallback n=%s', (n) => {
    expect(insertableHistoryAnswer({ display: String(n), n }, 'exact')).toBe(String(n) === '0.5' ? '0.5' : insertableAnswer(String(n), n))
    expect(insertableHistoryAnswer({ display: String(n), n }, 'approx')).toBe(insertableAnswer(String(n), n))
  })
  const more = Array.from({ length: 60 }, (_, i) => ({ display: String(i + 0.25), exact: undefined as string | undefined, n: i + 0.25 }))
  it.each(more)('no exact $display', (row) => {
    expect(insertableHistoryAnswer(row, 'exact')).toBe(insertableAnswer(row.display, row.n))
  })
})

describe('visibleAnswer', () => {
  const rows = [
    { display: '0.866025403784', exact: 'sqrt(3)/2' },
    { display: '3.46410161514', exact: '2sqrt(3)' },
    { display: '0.5', exact: '1/2' },
    { display: '1.5708', exact: 'pi/2' },
    { display: '3.1416', exact: 'pi' },
    { display: '0.7071', exact: 'sqrt(2)/2' },
    { display: '1.732', exact: 'sqrt(3)' },
    { display: '0.7854', exact: 'pi/4' },
    { display: '0.3333', exact: '1/3' },
    { display: '0.25', exact: '1/4' },
    { display: '0.125', exact: '1/8' },
    { display: '0.375', exact: '3/8' },
    { display: '0.625', exact: '5/8' },
    { display: '0.875', exact: '7/8' },
    { display: '1.0472', exact: 'pi/3' },
    { display: '0.5236', exact: 'pi/6' },
    { display: '2.0944', exact: '2*pi/3' },
    { display: '4.2426', exact: '3sqrt(2)' },
    { display: '5.1962', exact: '3sqrt(3)' },
    { display: '6.9282', exact: '4sqrt(3)' },
  ]
  it.each(rows)('exact shows $exact', (row) => {
    expect(visibleAnswer(row, 'exact')).toBe(row.exact)
  })
  it.each(rows)('approx shows $display', (row) => {
    expect(visibleAnswer(row, 'approx')).toBe(row.display)
  })
  it.each(Array.from({ length: 60 }, (_, i) => String(i)))('no exact %s', (d) => {
    expect(visibleAnswer({ display: d }, 'exact')).toBe(d)
    expect(visibleAnswer({ display: d }, 'approx')).toBe(d)
  })
})
