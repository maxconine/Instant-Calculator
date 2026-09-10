import { isImproperUnitConversion } from '../engine/units'

export const DEFAULT_DRAFT_SECONDS = 60
export const MIN_DRAFT_SECONDS = 0
export const MAX_DRAFT_SECONDS = 3600

export function clampDraftSeconds(n: number): number {
  if (!Number.isFinite(n) || n < MIN_DRAFT_SECONDS) return DEFAULT_DRAFT_SECONDS
  return Math.min(MAX_DRAFT_SECONDS, Math.round(n))
}

export type HideAction = 'commit' | 'keep' | 'clear'

/** Valid live results commit like Enter; unfinished input is kept for `draftSeconds`. */
export function hideAction(expr: string, display: string, draftSeconds: number): HideAction {
  if (!expr.trim()) return 'clear'
  if (isImproperUnitConversion(display)) return draftSeconds > 0 ? 'keep' : 'clear'
  if (display) return 'commit'
  return draftSeconds > 0 ? 'keep' : 'clear'
}

export function shouldRestoreDraft(savedAt: number, now: number, draftSeconds: number): boolean {
  if (draftSeconds <= 0 || !Number.isFinite(savedAt) || savedAt <= 0) return false
  return now - savedAt < draftSeconds * 1000
}
