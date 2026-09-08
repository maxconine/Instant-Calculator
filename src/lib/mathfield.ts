import { MathfieldElement } from 'mathlive'
import 'mathlive'

MathfieldElement.fontsDirectory = new URL('mathlive-fonts/', document.baseURI).href
MathfieldElement.soundsDirectory = null

export type MathFieldHost = MathfieldElement

let lastField: MathfieldElement | null = null

export function rememberMathField(el: MathfieldElement): void {
  lastField = el
}

export function lastMathField(): MathfieldElement | null {
  return lastField?.isConnected ? lastField : null
}

export function readLatex(el: MathfieldElement): string {
  const v = (el.getValue('latex-unstyled') || el.value).trim()
  if (!v || v === '\\placeholder{}' || v === '\\mathstrut') return ''
  return v
}

export function insertLatex(latex: string, selectionMode: 'placeholder' | 'after' = 'after'): boolean {
  const el = lastMathField()
  if (!el) return false
  el.focus()
  el.insert(latex, { focus: true, feedback: false, mode: 'math', selectionMode })
  el.dispatchEvent(new Event('input', { bubbles: true }))
  return true
}

export function applyInlineShortcuts(mf: MathfieldElement, ansLatex = 'ans'): void {
  if (!mf.isConnected) return
  let shortcuts: Record<string, string> = {}
  try {
    shortcuts = { ...(mf.inlineShortcuts as Record<string, string>) }
  } catch {
    shortcuts = {}
  }
  delete shortcuts.in
  delete shortcuts.sum
  delete shortcuts.int
  delete shortcuts.prod
  delete shortcuts.lim
  shortcuts.pi = '\\pi'
  shortcuts.Pi = '\\pi'
  shortcuts.theta = '\\theta'
  shortcuts.infty = '\\infty'
  shortcuts.inf = '\\infty'
  shortcuts.e = '\\exponentialE'
  shortcuts.sin = '\\sin\\left(#0\\right)'
  shortcuts.cos = '\\cos\\left(#0\\right)'
  shortcuts.tan = '\\tan\\left(#0\\right)'
  shortcuts.csc = '\\csc\\left(#0\\right)'
  shortcuts.sec = '\\sec\\left(#0\\right)'
  shortcuts.cot = '\\cot\\left(#0\\right)'
  shortcuts.asin = '\\arcsin\\left(#0\\right)'
  shortcuts.acos = '\\arccos\\left(#0\\right)'
  shortcuts.atan = '\\arctan\\left(#0\\right)'
  shortcuts.arcsin = '\\arcsin\\left(#0\\right)'
  shortcuts.arccos = '\\arccos\\left(#0\\right)'
  shortcuts.arctan = '\\arctan\\left(#0\\right)'
  shortcuts.sinh = '\\sinh\\left(#0\\right)'
  shortcuts.cosh = '\\cosh\\left(#0\\right)'
  shortcuts.tanh = '\\tanh\\left(#0\\right)'
  shortcuts.sqrt = '\\sqrt{#0}'
  shortcuts.cbrt = '\\sqrt[3]{#0}'
  shortcuts.nthroot = '\\sqrt[#0]{#1}'
  shortcuts.frac = '\\frac{#0}{#1}'
  shortcuts.abs = '\\left|#0\\right|'
  shortcuts.log = '\\log\\left(#0\\right)'
  shortcuts.ln = '\\ln\\left(#0\\right)'
  shortcuts.nCr = '\\operatorname{nCr}\\left(#0,#1\\right)'
  shortcuts.nPr = '\\operatorname{nPr}\\left(#0,#1\\right)'
  shortcuts.mean = '\\operatorname{mean}\\left(#0\\right)'
  shortcuts.median = '\\operatorname{median}\\left(#0\\right)'
  shortcuts.stdev = '\\operatorname{stdev}\\left(#0\\right)'
  shortcuts.gcd = '\\operatorname{gcd}\\left(#0,#1\\right)'
  shortcuts.lcm = '\\operatorname{lcm}\\left(#0,#1\\right)'
  shortcuts.ans = ansLatex
  mf.inlineShortcuts = shortcuts
}

export function insertableAnswer(display: string, n?: number): string {
  if (n != null && Number.isFinite(n)) {
    if (Math.abs(n) >= 1e12 || (n !== 0 && Math.abs(n) < 1e-6)) return n.toExponential()
    if (Number.isInteger(n) && Math.abs(n) < 1e12) return String(n)
    const s = String(n)
    if (s.includes('e') || s.includes('E')) return s
    return s
  }
  return display.replace(/,/g, '')
}
