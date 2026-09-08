import { convertLatexToMarkup } from 'mathlive/ssr'

export function StaticMath({ latex }: { latex: string }) {
  let html = latex
  try {
    html = convertLatexToMarkup(latex)
  } catch {
    html = latex
  }
  return <div className="static-math" dangerouslySetInnerHTML={{ __html: html }} />
}
