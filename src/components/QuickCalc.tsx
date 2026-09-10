import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { evaluateSheet } from '../engine/evaluate'
import { clampSigFigs, DEFAULT_SIG_FIGS } from '../engine/format'
import { defaultUnitsEqual, isImproperUnitConversion, sanitizeDefaultUnits, type DefaultUnits } from '../engine/units'
import { UnitSettings } from './UnitSettings'
import { insertableHistoryAnswer, type AnswerForm } from '../lib/answer'
import {
  clampDraftSeconds,
  DEFAULT_DRAFT_SECONDS,
  hideAction,
  shouldRestoreDraft,
} from '../lib/draft'
import {
  evaluateNative,
  hasNativeEval,
  mergeLiveAnswer,
  nativeReplyToLive,
  type NativeEvalReply,
  type NativeLive,
} from '../lib/nativeEval'
import { QuickInput, type QuickInputHandle } from './QuickInput'

export type AngleMode = 'deg' | 'rad'

type Settings = {
  angleMode: AngleMode
  fractionMode: boolean
  answerForm: AnswerForm
  sigFigs: number
  draftSeconds: number
  defaultUnits: DefaultUnits
}

type InstantBridge = {
  webkit?: {
    messageHandlers?: {
      instant?: { postMessage: (m: string | Record<string, unknown>) => void }
      soulver?: { postMessage: (m: Record<string, unknown> | string) => Promise<unknown> }
    }
  }
  __instantFocus?: () => void
  __instantReset?: () => void
  __instantWillHide?: () => void
  __instantSize?: () => void
  __instantApplySettings?: (s: Partial<Settings>) => void
  __instantNativeResult?: (reply: NativeEvalReply) => void
  __INSTANT_NATIVE?: boolean
  __INSTANT_KEYS?: string[]
  __INSTANT_SETTINGS?: Partial<Settings>
}

export type HistoryRow = {
  id: string
  expr: string
  display: string
  exact?: string
  n?: number
}

const HISTORY_KEY = 'instant-solver-history'
const SETTINGS_KEY = 'instant-solver-settings'
const DRAFT_KEY = 'instant-solver-draft'
const MAX_HISTORY = 10

function defaultSettings(): Settings {
  return {
    angleMode: 'deg',
    fractionMode: false,
    answerForm: 'exact',
    sigFigs: DEFAULT_SIG_FIGS,
    draftSeconds: DEFAULT_DRAFT_SECONDS,
    defaultUnits: {},
  }
}

function nativeBridge() {
  return (window as Window & InstantBridge).webkit?.messageHandlers?.instant
}

function dismissNative(): void {
  nativeBridge()?.postMessage('dismiss')
  nativeBridge()?.postMessage({ type: 'dismiss' })
}

function reportNativeHeight(el: HTMLElement | null): void {
  if (!el) return
  const height = Math.ceil(el.getBoundingClientRect().height)
  nativeBridge()?.postMessage(`height:${height}`)
  nativeBridge()?.postMessage({ type: 'size', height })
}

function loadHistory(): HistoryRow[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Array<Partial<HistoryRow> & { latex?: string }>
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((row) => ({
        id: typeof row.id === 'string' ? row.id : uid(),
        expr: row.expr ?? row.latex ?? '',
        display: row.display ?? '',
        exact: typeof row.exact === 'string' ? row.exact : undefined,
        n: typeof row.n === 'number' ? row.n : undefined,
      }))
      .filter((row) => row.expr || row.display)
      .slice(-MAX_HISTORY)
  } catch {
    return []
  }
}

function mergeSettings(partial: Partial<Settings> | undefined, base: Settings): Settings {
  return {
    angleMode: partial?.angleMode === 'rad' ? 'rad' : partial?.angleMode === 'deg' ? 'deg' : base.angleMode,
    fractionMode: partial?.fractionMode == null ? base.fractionMode : Boolean(partial.fractionMode),
    answerForm: partial?.answerForm === 'approx' ? 'approx' : partial?.answerForm === 'exact' ? 'exact' : base.answerForm,
    sigFigs: partial?.sigFigs == null ? base.sigFigs : clampSigFigs(partial.sigFigs),
    draftSeconds: partial?.draftSeconds == null ? base.draftSeconds : clampDraftSeconds(partial.draftSeconds),
    defaultUnits: partial?.defaultUnits == null ? base.defaultUnits : sanitizeDefaultUnits(partial.defaultUnits),
  }
}

type StoredDraft = { expr: string; savedAt: number }

function readStoredDraft(draftSeconds: number, now = Date.now()): StoredDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredDraft>
    const expr = typeof parsed.expr === 'string' ? parsed.expr : ''
    const savedAt = typeof parsed.savedAt === 'number' ? parsed.savedAt : 0
    if (!expr.trim() || !shouldRestoreDraft(savedAt, now, draftSeconds)) {
      localStorage.removeItem(DRAFT_KEY)
      return null
    }
    return { expr, savedAt }
  } catch {
    return null
  }
}

function writeStoredDraft(expr: string, savedAt = Date.now()): void {
  if (!expr.trim()) {
    localStorage.removeItem(DRAFT_KEY)
    return
  }
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ expr, savedAt } satisfies StoredDraft))
}

function clearStoredDraft(): void {
  localStorage.removeItem(DRAFT_KEY)
}

function settingsEqual(a: Settings, b: Settings): boolean {
  return (
    a.angleMode === b.angleMode &&
    a.fractionMode === b.fractionMode &&
    a.answerForm === b.answerForm &&
    a.sigFigs === b.sigFigs &&
    a.draftSeconds === b.draftSeconds &&
    defaultUnitsEqual(a.defaultUnits, b.defaultUnits)
  )
}

function loadSettings(): Settings {
  const fallback = defaultSettings()
  let stored = fallback
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) stored = mergeSettings(JSON.parse(raw) as Partial<Settings>, fallback)
  } catch {
    stored = fallback
  }
  const injected = (window as Window & InstantBridge).__INSTANT_SETTINGS
  return injected ? mergeSettings(injected, stored) : stored
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function copyText(text: string): void {
  if (!text) return
  nativeBridge()?.postMessage({ type: 'copy', text })
  void navigator.clipboard.writeText(text).catch(() => {
    const el = document.createElement('textarea')
    el.value = text
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    el.remove()
  })
}

function inputHighlight(el: EventTarget | null): string {
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return ''
  const start = el.selectionStart ?? 0
  const end = el.selectionEnd ?? 0
  return end > start ? el.value.slice(start, end) : ''
}

function highlightedText(): string {
  return (
    inputHighlight(document.querySelector('.quick-plain')) ||
    inputHighlight(document.activeElement) ||
    window.getSelection()?.toString() ||
    ''
  )
}

export function QuickCalcPage() {
  return (
    <div className="quick-app">
      <QuickCalc onClose={dismissNative} embedded />
    </div>
  )
}

export function QuickCalc({ onClose, embedded = false }: { onClose: () => void; embedded?: boolean }) {
  const [history, setHistory] = useState<HistoryRow[]>(loadHistory)
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [q, setQ] = useState(() => readStoredDraft(loadSettings().draftSeconds)?.expr ?? '')
  const [copied, setCopied] = useState<false | 'exact' | 'decimal'>(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [tapeOpen, setTapeOpen] = useState(false)
  const [nativeLive, setNativeLive] = useState<NativeLive | null>(null)
  const mathRef = useRef<QuickInputHandle | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const tapeRef = useRef<HTMLDivElement>(null)
  const copiedTimer = useRef(0)
  const tapeOpenRef = useRef(tapeOpen)
  const historyLenRef = useRef(history.length)
  const qRef = useRef(q)
  const displayRef = useRef('')
  const exactRef = useRef<string | undefined>(undefined)
  const liveNRef = useRef<number | undefined>(undefined)
  const settingsRef = useRef(settings)
  const draftAtRef = useRef(readStoredDraft(settings.draftSeconds)?.savedAt ?? 0)
  const draftTimer = useRef(0)
  const evalIdRef = useRef(0)
  tapeOpenRef.current = tapeOpen
  historyLenRef.current = history.length
  qRef.current = q
  settingsRef.current = settings

  const stopDraftTimer = useCallback(() => {
    window.clearTimeout(draftTimer.current)
    draftTimer.current = 0
  }, [])

  const resetToCalculate = useCallback(() => {
    qRef.current = ''
    draftAtRef.current = 0
    stopDraftTimer()
    clearStoredDraft()
    setQ('')
    setSelected(null)
    setTapeOpen(false)
    setCopied(false)
    setNativeLive(null)
    mathRef.current?.setValue('')
    mathRef.current?.focus()
  }, [stopDraftTimer])

  const sheet = useMemo(() => {
    const lines = [...history.map((h) => h.expr), q]
    return evaluateSheet(lines, {
      angleMode: settings.angleMode,
      fractionMode: settings.fractionMode,
      sigFigs: settings.sigFigs,
      defaultUnits: settings.defaultUnits,
    })
  }, [history, q, settings.angleMode, settings.fractionMode, settings.sigFigs, settings.defaultUnits])

  const live = sheet[sheet.length - 1]
  const jsDisplay = q.trim() ? (live?.display ?? '') : ''
  const jsN = live?.value?.kind === 'number' ? live.value.n : undefined
  const merged = mergeLiveAnswer(q, jsDisplay, jsN, nativeLive)
  const display = merged.display
  const liveN = merged.n
  const liveExact = q.trim() && jsDisplay ? live?.exact : undefined
  displayRef.current = display
  exactRef.current = liveExact
  liveNRef.current = liveN

  const nativeVars = useMemo(() => {
    const vars: Record<string, number> = {}
    for (const row of sheet.slice(0, -1)) {
      if (row.variable && row.value?.kind === 'number' && Number.isFinite(row.value.n)) {
        vars[row.variable] = row.value.n
      }
    }
    return vars
  }, [sheet])

  const lastAnswer = useMemo(() => {
    for (let i = history.length - 1; i >= 0; i--) {
      const row = history[i]
      if (!row) continue
      if (row.n != null && Number.isFinite(row.n)) return row
      if (row.display.trim()) return row
    }
    return undefined
  }, [history])

  const lastAns = lastAnswer?.n
  const ansPlain = lastAnswer ? insertableHistoryAnswer(lastAnswer, settings.answerForm) : undefined

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)))
  }, [history])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    nativeBridge()?.postMessage({ type: 'settings', sigFigs: settings.sigFigs })
  }, [settings])

  useEffect(() => {
    const el = tapeRef.current
    if (!el) return
    if (selected == null) el.scrollTop = el.scrollHeight
    else {
      const row = el.querySelector(`[data-hist="${selected}"]`) as HTMLElement | null
      if (!row) return
      const parentBox = el.getBoundingClientRect()
      const rowBox = row.getBoundingClientRect()
      if (rowBox.top < parentBox.top) el.scrollTop -= parentBox.top - rowBox.top
      else if (rowBox.bottom > parentBox.bottom) el.scrollTop += rowBox.bottom - parentBox.bottom
    }
  }, [history.length, selected, tapeOpen])

  const flashCopied = useCallback((kind: 'exact' | 'decimal' = 'decimal') => {
    setCopied(kind)
    window.clearTimeout(copiedTimer.current)
    copiedTimer.current = window.setTimeout(() => setCopied(false), 1200)
  }, [])

  const copyOutput = useCallback(() => {
    const highlighted = mathRef.current?.highlighted() || highlightedText()
    if (highlighted) {
      copyText(highlighted)
      return
    }
    const row = selected != null ? history[selected] : null
    const text = row?.display || display
    if (!text) return
    copyText(text)
    flashCopied()
  }, [display, flashCopied, history, selected])

  const insertHistoryAnswer = useCallback(
    (index: number) => {
      const row = history[index]
      if (!row) return
      const chunk = insertableHistoryAnswer(row, settings.answerForm)
      if (!chunk) return
      mathRef.current?.insert(chunk)
      mathRef.current?.focus()
      setSelected(null)
      setTapeOpen(false)
    },
    [history, settings.answerForm],
  )

  const copyExact = useCallback(
    (text: string) => {
      if (!text) return
      copyText(text)
      flashCopied('exact')
    },
    [flashCopied],
  )

  const copyLive = useCallback(() => {
    if (!display) return
    copyText(display)
    flashCopied('decimal')
  }, [display, flashCopied])

  const commit = useCallback(() => {
    const expr = qRef.current
    const shown = displayRef.current
    const exact = exactRef.current
    const n = liveNRef.current
    if (!expr.trim() || !shown || isImproperUnitConversion(shown)) return
    setHistory((prev) => {
      const last = prev[prev.length - 1]
      if (last && last.expr === expr && last.display === shown) return prev
      return [
        ...prev,
        {
          id: uid(),
          expr,
          display: shown,
          exact: exact && exact !== shown ? exact : undefined,
          n: Number.isFinite(n) ? n : undefined,
        },
      ].slice(-MAX_HISTORY)
    })
    qRef.current = ''
    displayRef.current = ''
    exactRef.current = undefined
    liveNRef.current = undefined
    draftAtRef.current = 0
    stopDraftTimer()
    clearStoredDraft()
    setQ('')
    mathRef.current?.setValue('')
    mathRef.current?.focus()
    setSelected(null)
    setTapeOpen(false)
  }, [stopDraftTimer])

  const restoreDraft = useCallback((expr: string, savedAt: number) => {
    stopDraftTimer()
    qRef.current = expr
    draftAtRef.current = savedAt
    setQ(expr)
    mathRef.current?.setValue(expr)
    setSelected(null)
    setTapeOpen(false)
    setCopied(false)
    mathRef.current?.focus()
  }, [stopDraftTimer])

  const onWillHide = useCallback(() => {
    const expr = qRef.current
    const ttl = settingsRef.current.draftSeconds
    const action = hideAction(expr, displayRef.current, ttl)
    if (action === 'commit') {
      commit()
      return
    }
    setSelected(null)
    setTapeOpen(false)
    setCopied(false)
    if (action === 'keep') {
      const savedAt = Date.now()
      draftAtRef.current = savedAt
      writeStoredDraft(expr, savedAt)
      stopDraftTimer()
      draftTimer.current = window.setTimeout(() => {
        if (draftAtRef.current !== savedAt) return
        resetToCalculate()
      }, ttl * 1000)
      return
    }
    resetToCalculate()
  }, [commit, resetToCalculate, stopDraftTimer])

  const onPrepare = useCallback(() => {
    stopDraftTimer()
    const ttl = settingsRef.current.draftSeconds
    const now = Date.now()
    const stored = readStoredDraft(ttl, now)
    const expr = qRef.current
    const draftLive = shouldRestoreDraft(draftAtRef.current, now, ttl)

    if (expr.trim()) {
      if (draftLive || stored) return
      if (!draftAtRef.current) return
      resetToCalculate()
      return
    }

    if (stored) {
      restoreDraft(stored.expr, stored.savedAt)
      return
    }
    resetToCalculate()
  }, [resetToCalculate, restoreDraft, stopDraftTimer])

  const onUp = useCallback((): boolean => {
    if (!history.length) return false
    const el = mathRef.current?.element()
    if (selected == null && el && (el.selectionStart ?? 0) !== 0 && q.trim()) return false
    if (!tapeOpen) {
      setTapeOpen(true)
      setSelected(history.length - 1)
      return true
    }
    setSelected((cur) => (cur == null ? history.length - 1 : Math.max(0, cur - 1)))
    return true
  }, [history.length, q, selected, tapeOpen])

  const onDown = useCallback((): boolean => {
    if (!tapeOpen) return false
    if (selected == null || selected >= history.length - 1) {
      setSelected(null)
      mathRef.current?.focus()
      return true
    }
    setSelected(selected + 1)
    return true
  }, [history.length, selected, tapeOpen])

  const onEnter = useCallback(() => {
    if (selected != null) {
      insertHistoryAnswer(selected)
      return
    }
    commit()
  }, [commit, selected, insertHistoryAnswer])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault()
        e.stopPropagation()
        if (embedded) onWillHide()
        else resetToCalculate()
        onClose()
        return
      }
      const ctrlOnly = e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey
      const key = e.key.toLowerCase()
      if (ctrlOnly && key === 'd') {
        e.preventDefault()
        e.stopPropagation()
        setSettings((s) => ({ ...s, angleMode: s.angleMode === 'deg' ? 'rad' : 'deg' }))
        return
      }
      if (ctrlOnly && key === 'f') {
        e.preventDefault()
        e.stopPropagation()
        setSettings((s) => ({ ...s, fractionMode: !s.fractionMode }))
        return
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && key === 'c') {
        e.preventDefault()
        e.stopPropagation()
        copyOutput()
      }
    }
    const onCopy = (e: ClipboardEvent) => {
      const highlighted =
        inputHighlight(e.target) || mathRef.current?.highlighted() || highlightedText()
      if (highlighted) {
        e.preventDefault()
        e.clipboardData?.setData('text/plain', highlighted)
        nativeBridge()?.postMessage({ type: 'copy', text: highlighted })
        return
      }
      const row = selected != null ? history[selected] : null
      const text = row?.display || display
      if (!text) return
      e.preventDefault()
      e.clipboardData?.setData('text/plain', text)
      nativeBridge()?.postMessage({ type: 'copy', text })
      flashCopied()
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('copy', onCopy, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('copy', onCopy, true)
    }
  }, [copyOutput, display, embedded, flashCopied, history, onClose, onWillHide, resetToCalculate, selected])

  useEffect(() => () => stopDraftTimer(), [stopDraftTimer])

  useEffect(() => {
    if (!q.trim() || !hasNativeEval()) return
    const id = ++evalIdRef.current
    const expr = q
    let cancelled = false
    void evaluateNative({
      id,
      expr,
      ans: lastAns,
      sigFigs: settings.sigFigs,
      variables: nativeVars,
    }).then((reply) => {
      if (cancelled || evalIdRef.current !== id) return
      if (!reply) return
      setNativeLive(nativeReplyToLive(reply, id, qRef.current))
    })
    return () => {
      cancelled = true
    }
  }, [q, lastAns, settings.sigFigs, nativeVars])

  useEffect(() => {
    const w = window as Window & InstantBridge
    const size = () => reportNativeHeight(rootRef.current)
    w.__instantFocus = () => mathRef.current?.focus()
    w.__instantSize = size
    w.__instantWillHide = () => onWillHide()
    w.__instantReset = () => {
      onPrepare()
      requestAnimationFrame(size)
    }
    w.__instantApplySettings = (partial) => {
      setSettings((prev) => {
        const next = mergeSettings(partial, prev)
        return settingsEqual(next, prev) ? prev : next
      })
    }
    w.__instantNativeResult = (reply) => {
      const next = nativeReplyToLive(reply, evalIdRef.current, qRef.current)
      if (next) {
        setNativeLive(next)
        return
      }
      if (reply.id === evalIdRef.current && reply.expr === qRef.current) {
        setNativeLive(null)
      }
    }
    const onSoulver = (event: Event) => {
      const reply = (event as CustomEvent<NativeEvalReply>).detail
      if (!reply) return
      w.__instantNativeResult?.(reply)
    }
    window.addEventListener('instant-soulver', onSoulver)
    const el = rootRef.current
    size()
    const ro = el ? new ResizeObserver(() => reportNativeHeight(el)) : null
    if (el && ro) ro.observe(el)
    const t1 = window.setTimeout(() => mathRef.current?.focus(), 0)
    const t2 = window.setTimeout(() => mathRef.current?.focus(), 50)
    const t3 = window.setTimeout(() => mathRef.current?.focus(), 120)
    return () => {
      window.removeEventListener('instant-soulver', onSoulver)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
      ro?.disconnect()
    }
  }, [onPrepare, onWillHide])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onWheel = (e: WheelEvent) => {
      const tape = tapeRef.current
      const overTape = Boolean(tape && e.target instanceof Node && tape.contains(e.target))
      const open = tapeOpenRef.current
      const hasHistory = historyLenRef.current > 0

      if (e.deltaY < 0) {
        if (!hasHistory) {
          if (!overTape) e.preventDefault()
          return
        }
        if (!open) {
          e.preventDefault()
          setTapeOpen(true)
          return
        }
        if (!overTape) {
          e.preventDefault()
          tape?.scrollBy({ top: e.deltaY })
        }
        return
      }

      if (!open) {
        e.preventDefault()
        return
      }
      if (!tape) {
        e.preventDefault()
        return
      }
      const atBottom = tape.scrollTop + tape.clientHeight >= tape.scrollHeight - 1
      if (atBottom) {
        e.preventDefault()
        setTapeOpen(false)
        setSelected(null)
        return
      }
      if (!overTape) {
        e.preventDefault()
        tape.scrollTop += e.deltaY
      }
    }
    root.addEventListener('wheel', onWheel, { passive: false })
    return () => root.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <div className={embedded ? undefined : 'quick-wrap'}>
    <div
      ref={rootRef}
      className={`spotlight ${embedded ? 'spotlight-embedded' : ''}`}
      onMouseDown={(e) => {
        const t = e.target as HTMLElement
        if (t.closest('input, button, .tape, .quick-plain, .quick-field, .modes, .unit-settings')) return
        nativeBridge()?.postMessage({ type: 'drag' })
        nativeBridge()?.postMessage('drag')
      }}
    >
      {tapeOpen && history.length > 0 ? (
        <div className="tape" ref={tapeRef} aria-label="Calculation history">
          {history.map((row, i) => (
            <div
              className={`tape-row ${selected === i ? 'selected' : ''}`}
              data-hist={i}
              key={row.id}
            >
              <button
                type="button"
                className="tape-q"
                title={
                  settings.answerForm === 'exact' && row.exact
                    ? 'Insert exact value at the cursor'
                    : 'Insert approximation at the cursor'
                }
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertHistoryAnswer(i)}
              >
                {row.expr}
              </button>
              <div className="tape-a">
                {row.exact && row.exact !== row.display ? (
                  <>
                    <button
                      type="button"
                      className={`tape-exact ${settings.answerForm === 'exact' ? 'insert-target' : ''}`}
                      title="Insert exact value at the cursor"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertHistoryAnswer(i)}
                    >
                      {row.exact}
                    </button>
                    <span className="tape-approx" aria-hidden>
                      ≈
                    </span>
                  </>
                ) : null}
                <button
                  type="button"
                  className={`tape-decimal ${settings.answerForm === 'approx' || !row.exact || row.exact === row.display ? 'insert-target' : ''}`}
                  title="Insert approximation at the cursor"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertHistoryAnswer(i)}
                >
                  {row.display}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="composer">
        <div className="modes">
          <button
            type="button"
            className={settings.angleMode === 'deg' ? 'active' : ''}
            title="Degrees · ⌃D"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setSettings((s) => ({ ...s, angleMode: 'deg' }))}
          >
            deg
          </button>
          <button
            type="button"
            className={settings.angleMode === 'rad' ? 'active' : ''}
            title="Radians · ⌃D"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setSettings((s) => ({ ...s, angleMode: 'rad' }))}
          >
            rad
          </button>
          <button
            type="button"
            className={settings.fractionMode ? 'active' : ''}
            title="Fraction results · ⌃F"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setSettings((s) => ({ ...s, fractionMode: !s.fractionMode }))}
          >
            a/b
          </button>
          <button
            type="button"
            className={settings.answerForm === 'exact' ? 'active' : ''}
            title="Insert exact values from history"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setSettings((s) => ({ ...s, answerForm: 'exact' }))}
          >
            exact
          </button>
          <button
            type="button"
            className={settings.answerForm === 'approx' ? 'active' : ''}
            title="Insert decimal approximations from history"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setSettings((s) => ({ ...s, answerForm: 'approx' }))}
          >
            approx
          </button>
        </div>
        <QuickInput
          value={q}
          ansPlain={ansPlain}
          handleRef={mathRef}
          onChange={(text) => {
            setQ(text)
            if (selected != null && history[selected]?.expr !== text) setSelected(null)
          }}
          onEnter={onEnter}
          onUp={onUp}
          onDown={onDown}
        />
        <div className={`live-group ${display ? '' : 'empty'}`}>
          {liveExact && liveExact !== display ? (
            <>
              <button
                type="button"
                className={`live live-exact ${copied === 'exact' ? 'copied' : ''}`}
                title="Copy exact value"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => copyExact(liveExact)}
              >
                {copied === 'exact' ? 'copied to clipboard' : liveExact}
              </button>
              <span className="live-approx" aria-hidden>
                ≈
              </span>
            </>
          ) : null}
          <button
            type="button"
            className={`live ${copied === 'decimal' ? 'copied' : ''} ${display ? '' : 'empty'} ${isImproperUnitConversion(display) ? 'message' : ''}`}
            title={
              display && !isImproperUnitConversion(display)
                ? 'Copy to clipboard · ⌘C also copies'
                : undefined
            }
            disabled={!display || isImproperUnitConversion(display)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={copyLive}
          >
            {copied === 'decimal' ? 'copied to clipboard' : display}
          </button>
        </div>
      </div>
    </div>
    {!embedded ? (
      <UnitSettings
        value={settings.defaultUnits}
        onChange={(defaultUnits) => setSettings((s) => ({ ...s, defaultUnits }))}
      />
    ) : null}
    </div>
  )
}
