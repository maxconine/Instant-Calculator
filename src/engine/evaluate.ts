import type { EvaluateOptions, LineResult, SheetInputLine, Value } from './types'
import { formatValue } from './format'
import { tryPlainMath } from './plainMath'
import { formatAsFraction } from './scientific'

const RESERVED = new Set(
  (
    'sqrt|cbrt|nthroot|nthRoot|sin|cos|tan|csc|sec|cot|asin|acos|atan|arcsin|arccos|arctan|arccsc|arcsec|arccot|sinh|cosh|tanh|csch|sech|coth|asinh|acosh|atanh|arsinh|arcosh|artanh|arcsinh|arccosh|arctanh|arccsch|arcsech|arccoth|acsch|asech|acoth|ln|log|log2|log10|exp|abs|sign|floor|ceil|round|clamp|min|max|mean|median|mad|std|stdev|stdevp|var|varp|sum|total|length|count|quartile|quantile|corr|gcd|lcm|mod|hypot|factorial|nCr|nPr|combinations|permutations|randint|rand|random|re|im|real|imag|conj|arg|range|desmosRange|pi|tau|inf|infinity|ans|e'
  ).split('|'),
)

function show(value: Value, fractionMode: boolean): string {
  if (value.kind === 'text' && value.text) return value.text
  if (fractionMode && value.kind === 'number') {
    const f = formatAsFraction(value.n)
    if (f) return f
  }
  return formatValue(value)
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
  const variables: Record<string, number> = {}
  let lastAns = options.ans
  const results: LineResult[] = []

  for (const raw of texts) {
    const trimmed = raw.trim()
    if (!trimmed) {
      results.push({ raw, kind: 'empty', display: '', tags: [], dependsOn: [] })
      continue
    }

    let expr = trimmed
    let variable: string | undefined
    const assign = trimmed.match(/^([A-Za-z][A-Za-z0-9]*)\s*=\s*(.+)$/)
    if (assign && !RESERVED.has(assign[1].toLowerCase())) {
      variable = assign[1]
      expr = assign[2].trim()
    }

    const value = tryPlainMath(expr, { ans: lastAns, angleMode, variables })
    if (!value) {
      results.push({
        raw,
        kind: variable ? 'assignment' : 'expression',
        display: '',
        variable,
        tags: [],
        dependsOn: [],
      })
      continue
    }

    const n = numeric(value)
    if (n !== undefined) lastAns = n
    if (variable && n !== undefined) variables[variable] = n

    results.push({
      raw,
      kind: variable ? 'assignment' : 'expression',
      value,
      display: show(value, fractionMode),
      variable,
      tags: [],
      dependsOn: [],
    })
  }

  return results
}

export function evaluateLine(text: string, options: EvaluateOptions = {}): LineResult {
  return evaluateSheet([text], options)[0]!
}
