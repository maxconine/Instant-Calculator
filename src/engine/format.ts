import type { Value } from './types'

export function formatNumber(n: number, max = 12): string {
  if (n === Infinity) return '∞'
  if (n === -Infinity) return '-∞'
  if (!Number.isFinite(n)) return 'undefined'
  if (Object.is(n, -0) || n === 0) return '0'
  const abs = Math.abs(n)
  if (abs < 1e-6 || abs >= 1e12) {
    return n
      .toExponential(6)
      .replace(/(\.\d*?)0+(e[+-]?\d+)$/, '$1$2')
      .replace(/\.e/, 'e')
  }
  const rounded = Number(n.toPrecision(16))
  let s = String(rounded)
  if (s.includes('e')) {
    return rounded
      .toExponential(6)
      .replace(/(\.\d*?)0+(e[+-]?\d+)$/, '$1$2')
      .replace(/\.e/, 'e')
  }
  if (s.includes('.')) {
    const [, frac = ''] = s.split('.')
    if (frac.length > max) {
      s = Number(rounded.toFixed(max)).toString()
    }
  }
  return s
}

export function formatValue(value: Value): string {
  if (value.kind === 'text') return value.text ?? ''
  return formatNumber(value.n)
}

export function num(n: number): Value {
  return { kind: 'number', n }
}

export function textVal(text: string): Value {
  return { kind: 'text', n: 0, text }
}
