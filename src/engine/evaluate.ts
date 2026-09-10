import type { EvaluateOptions, LineResult, SheetInputLine, Value } from './types'
import { DEFAULT_SIG_FIGS, formatValue } from './format'
import { tryPlainMath } from './plainMath'
import { formatAsFraction } from './scientific'
import { exactForm } from './simplify'

const RESERVED = new Set(
  (
    'sqrt|cbrt|nthroot|nthRoot|sin|cos|tan|csc|sec|cot|asin|acos|atan|arcsin|arccos|arctan|arccsc|arcsec|arccot|sinh|cosh|tanh|csch|sech|coth|asinh|acosh|atanh|arsinh|arcosh|artanh|arcsinh|arccosh|arctanh|arccsch|arcsech|arccoth|acsch|asech|acoth|ln|log|log2|log10|exp|abs|sign|floor|ceil|round|clamp|min|max|mean|median|mad|std|stdev|stdevp|var|varp|sum|total|length|count|quartile|quantile|corr|gcd|lcm|mod|hypot|factorial|nCr|nPr|combinations|permutations|randint|rand|random|re|im|real|imag|conj|arg|range|desmosRange|pi|tau|inf|infinity|ans|e'
  ).split('|'),
)

function show(value: Value, fractionMode: boolean, sigFigs: number): string {
  if (value.kind === 'text' && value.text) return value.text
  if (value.unit) return formatValue(value, sigFigs)
  if (fractionMode && value.kind === 'number') {
    const f = formatAsFraction(value.n)
    if (f) return f
  }
  return formatValue(value, sigFigs)
}

function numeric(value: Value | undefined): number | undefined {
  if (!value || value.kind === 'text') return undefined
  if (!Number.isFinite(value.n)) return undefined
  return value.n
}

export function evaluateSheet(lines: SheetInputLine[] | string[], options: EvaluateOptions = {}): LineResult[] {
  const texts = lines.map((l) => (typeof l === 'string' ? l : l.text))
  const angleMode = options.angleMode ?? 'deg'
  const fractionMode = options.fractionMode ?? false
  const sigFigs = options.sigFigs ?? DEFAULT_SIG_FIGS
  const variables: Record<string, number> = {}
  let lastAns = options.ans
  const results: LineResult[] = []

  for (const raw of texts) {
    const trimmed = raw.trim()
    if (!trimmed) {
      results.push({ raw, kind: 'empty', display: '' })
      continue
    }

    let expr = trimmed
    let variable: string | undefined
    const assign = trimmed.match(/^([A-Za-z][A-Za-z0-9]*)\s*=\s*(.+)$/)
    if (assign && !RESERVED.has(assign[1].toLowerCase())) {
      variable = assign[1]
      expr = assign[2].trim()
    }

    let value: Value | null = null
    try {
      value = tryPlainMath(expr, { ans: lastAns, angleMode, variables, defaultUnits: options.defaultUnits })
    } catch {
      value = null
    }
    if (!value) {
      results.push({
        raw,
        kind: variable ? 'assignment' : 'expression',
        display: '',
        variable,
      })
      continue
    }

    const n = numeric(value)
    if (n !== undefined) lastAns = n
    if (variable && n !== undefined) variables[variable] = n

    let display = ''
    try {
      display = show(value, fractionMode, sigFigs)
    } catch {
      display = ''
    }
    const exact =
      value.kind === 'number' && !value.unit && Number.isFinite(value.n) ? (exactForm(value.n) ?? undefined) : undefined
    results.push({
      raw,
      kind: variable ? 'assignment' : 'expression',
      value,
      display,
      exact,
      variable,
    })
  }

  return results
}

export function evaluateLine(text: string, options: EvaluateOptions = {}): LineResult {
  return evaluateSheet([text], options)[0]!
}
