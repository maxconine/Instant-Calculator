export type ParenFill = {
  leading: number
  trailing: number
  filled: string
}

function countUnmatched(expr: string): { leading: number; trailing: number } {
  let depth = 0
  let minDepth = 0
  for (const ch of expr) {
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth < minDepth) minDepth = depth
    }
  }
  const leading = -minDepth
  const trailing = depth + leading
  return { leading, trailing }
}

/** Count unmatched parens and the grey ( / ) needed to balance them. */
export function inferParens(expr: string): ParenFill {
  const { leading, trailing } = countUnmatched(expr)
  if (!leading && !trailing) return { leading: 0, trailing: 0, filled: expr }
  return {
    leading,
    trailing,
    filled: `${'('.repeat(leading)}${expr}${')'.repeat(trailing)}`,
  }
}

export function fillParens(expr: string): string {
  return inferParens(expr).filled
}
