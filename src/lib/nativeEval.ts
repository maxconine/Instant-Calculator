import {
  IMPROPER_UNIT_CONVERSION,
  isImproperUnitConversion,
} from '../engine/units'
import { nativeWindow } from './bridge'

export type NativeEvalRequest = {
  id: number
  expr: string
  ans?: number
  sigFigs?: number
  variables?: Record<string, number>
}

export type NativeEvalReply = {
  id: number
  expr: string
  display: string
  n?: number | null
}

export type NativeLive = {
  expr: string
  display: string
  n?: number
}

export function hasNativeEval(): boolean {
  const w = nativeWindow()
  if (!w) return false
  return Boolean(w.__QCALC_NATIVE || w.webkit?.messageHandlers?.soulver || w.webkit?.messageHandlers?.qcalc)
}

/** WKWebView rejects objects that contain `undefined`, so omit optional fields instead of spreading. */
export function nativeEvalPayload(req: NativeEvalRequest): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    type: 'eval',
    id: req.id,
    expr: req.expr,
  }
  if (req.sigFigs != null && Number.isFinite(req.sigFigs)) payload.sigFigs = req.sigFigs
  if (req.ans != null && Number.isFinite(req.ans)) payload.ans = req.ans
  if (req.variables && Object.keys(req.variables).length > 0) payload.variables = req.variables
  return payload
}

export function looksLikeNaturalLanguage(expr: string): boolean {
  const t = expr.trim()
  if (!t) return false
  if (/[$€£¥₹]/.test(t)) return true
  if (/\b(?:am|pm)\b/i.test(t)) return true
  if (/\d{1,2}:\d{2}/.test(t)) return true
  if (/%/.test(t) && /\b(?:of|off|on|what|is)\b/i.test(t)) return true
  return /\b(?:what|what's|whats|tip|lunch|today|tomorrow|yesterday|percent|people|nights|from|until|between|per|ago)\b/i.test(
    t,
  )
}

/** SoulverCore reports failed conversions as "Error: …" instead of an empty result. */
export function usableNativeDisplay(display: string): string {
  const t = display.trim()
  if (!t) return ''
  if (isImproperUnitConversion(t)) return IMPROPER_UNIT_CONVERSION
  if (/^error:\s*incompatible units\b/i.test(t)) return IMPROPER_UNIT_CONVERSION
  if (/^error\b/i.test(t)) return ''
  return t
}

function normalizeReply(raw: unknown, req: NativeEvalRequest): NativeEvalReply | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const display = usableNativeDisplay(typeof o.display === 'string' ? o.display : '')
  const expr = typeof o.expr === 'string' ? o.expr : req.expr
  const id = typeof o.id === 'number' && Number.isFinite(o.id) ? o.id : req.id
  const n = typeof o.n === 'number' && Number.isFinite(o.n) ? o.n : null
  return { id, expr, display, n }
}

/** Ask SoulverCore and wait for the answer. Falls back to a fire-and-forget message if the reply handler is missing. */
export async function evaluateNative(req: NativeEvalRequest): Promise<NativeEvalReply | null> {
  const w = nativeWindow()
  const payload = nativeEvalPayload(req)
  const soulver = w?.webkit?.messageHandlers?.soulver
  if (soulver) {
    try {
      return normalizeReply(await soulver.postMessage(payload), req)
    } catch {
      /* use the host handler below */
    }
  }
  const host = w?.webkit?.messageHandlers?.qcalc
  if (!host) return null
  try {
    host.postMessage(payload)
  } catch {
    return null
  }
  return null
}

export function mergeLiveAnswer(
  expr: string,
  jsDisplay: string,
  jsN: number | undefined,
  native: NativeLive | null,
): { display: string; n?: number } {
  if (!expr.trim()) return { display: '' }
  const nativeDisplay = native && native.expr === expr ? usableNativeDisplay(native.display) : ''
  const nativeHit = native && nativeDisplay ? { ...native, display: nativeDisplay } : null
  if (nativeHit && looksLikeNaturalLanguage(expr)) {
    return { display: nativeHit.display, n: nativeHit.n }
  }
  if (jsDisplay) return { display: jsDisplay, n: jsN }
  if (nativeHit) return { display: nativeHit.display, n: nativeHit.n }
  return { display: '' }
}

export function nativeReplyToLive(reply: NativeEvalReply, expectedId: number, currentExpr: string): NativeLive | null {
  if (reply.id !== expectedId) return null
  if (reply.expr !== currentExpr) return null
  const display = usableNativeDisplay(typeof reply.display === 'string' ? reply.display : '')
  if (!display) return null
  const n = typeof reply.n === 'number' && Number.isFinite(reply.n) ? reply.n : undefined
  return { expr: reply.expr, display, n }
}
