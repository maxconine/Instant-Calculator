import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { evaluateSheet } from '../engine/evaluate'
import { insertableAnswer } from '../lib/mathfield'
import { QuickInput, type QuickInputHandle } from './QuickInput'

export type AngleMode = 'deg' | 'rad'

type InstantBridge = {
  webkit?: { messageHandlers?: { instant?: { postMessage: (m: string | Record<string, unknown>) => void } } }
  __instantFocus?: () => void
  __instantReset?: () => void
  __INSTANT_KEYS?: string[]
}

export type HistoryRow = {
  id: string
  latex: string
  display: string
  n?: number
}

const HISTORY_KEY = 'instant-solver-history'
const SETTINGS_KEY = 'instant-solver-settings'
const MAX_HISTORY = 80

type Settings = { angleMode: AngleMode; fractionMode: boolean }

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
    const parsed = JSON.parse(raw) as HistoryRow[]
    return Array.isArray(parsed) ? parsed.slice(-MAX_HISTORY) : []
  } catch {
    return []
  }
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { angleMode: 'deg', fractionMode: false }
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      angleMode: parsed.angleMode === 'rad' ? 'rad' : 'deg',
      fractionMode: Boolean(parsed.fractionMode),
    }
  } catch {
    return { angleMode: 'deg', fractionMode: false }
  }
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

export function QuickCalcPage() {
  return (
    <div className="quick-app">
      <QuickCalc onClose={dismissNative} embedded />
    </div>
  )
}

export function QuickCalc({ onClose, embedded = false }: { onClose: () => void; embedded?: boolean }) {
  const [q, setQ] = useState('')
  const [history, setHistory] = useState<HistoryRow[]>(loadHistory)
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [copied, setCopied] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [tapeOpen, setTapeOpen] = useState(false)
  const mathRef = useRef<QuickInputHandle | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const tapeRef = useRef<HTMLDivElement>(null)
  const draftRef = useRef('')
  const copiedTimer = useRef(0)

  const resetToCalculate = useCallback(() => {
    setQ('')
    setSelected(null)
    setTapeOpen(false)
    setCopied(false)
    draftRef.current = ''
    mathRef.current?.setValue('')
    mathRef.current?.focus()
  }, [])

  const sheet = useMemo(() => {
    const lines = [...history.map((h) => h.latex), q]
    return evaluateSheet(lines, {
      angleMode: settings.angleMode,
      fractionMode: settings.fractionMode,
    })
  }, [history, q, settings.angleMode, settings.fractionMode])

  const live = sheet[sheet.length - 1]
  const display = q.trim() ? (live?.display ?? '') : ''
  const liveN = live?.value?.kind === 'number' ? live.value.n : undefined

  const lastAns = useMemo(() => {
    for (let i = history.length - 1; i >= 0; i--) {
      const n = history[i]?.n
      if (n != null && Number.isFinite(n)) return n
    }
    return undefined
  }, [history])

  const ansPlain = lastAns == null ? undefined : insertableAnswer(String(lastAns), lastAns)

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)))
  }, [history])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    const el = tapeRef.current
    if (!el) return
    if (selected == null) el.scrollTop = el.scrollHeight
    else {
      const row = el.querySelector(`[data-hist="${selected}"]`)
      row?.scrollIntoView({ block: 'nearest' })
    }
  }, [history.length, selected])

  const flashCopied = useCallback(() => {
    setCopied(true)
    window.clearTimeout(copiedTimer.current)
    copiedTimer.current = window.setTimeout(() => setCopied(false), 700)
  }, [])

  const copyOutput = useCallback(() => {
    const row = selected != null ? history[selected] : null
    const text = row?.display || display
    if (!text) return
    copyText(text)
    flashCopied()
  }, [display, flashCopied, history, selected])

  const insertAnswer = useCallback(
    (shown: string, n?: number) => {
      if (!shown) return
      const chunk = insertableAnswer(shown, n)
      mathRef.current?.insert(chunk)
      mathRef.current?.focus()
      setSelected(null)
      setTapeOpen(false)
    },
    [],
  )

  const useHistoryAnswer = useCallback(
    (index: number) => {
      const row = history[index]
      if (!row) return
      insertAnswer(row.display, row.n)
    },
    [history, insertAnswer],
  )

  const commit = useCallback(() => {
    if (!q.trim() || !display) return
    setHistory((prev) => {
      const last = prev[prev.length - 1]
      if (last && last.latex === q && last.display === display) return prev
      return [...prev, { id: uid(), latex: q, display, n: Number.isFinite(liveN) ? liveN : undefined }]
    })
    setQ('')
    mathRef.current?.setValue('')
    mathRef.current?.focus()
    setSelected(null)
    setTapeOpen(false)
    draftRef.current = ''
  }, [display, liveN, q])

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
      useHistoryAnswer(selected)
      return
    }
    commit()
  }, [commit, selected, useHistoryAnswer])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault()
        e.stopPropagation()
        resetToCalculate()
        onClose()
        return
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        e.stopPropagation()
        copyOutput()
      }
    }
    const onCopy = (e: ClipboardEvent) => {
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
  }, [copyOutput, display, flashCopied, history, onClose, resetToCalculate, selected])

  useEffect(() => {
    const w = window as Window & InstantBridge
    w.__instantFocus = () => mathRef.current?.focus()
    w.__instantReset = () => resetToCalculate()
    const el = rootRef.current
    reportNativeHeight(el)
    const ro = el ? new ResizeObserver(() => reportNativeHeight(el)) : null
    if (el && ro) ro.observe(el)
    const t1 = window.setTimeout(() => mathRef.current?.focus(), 0)
    const t2 = window.setTimeout(() => mathRef.current?.focus(), 50)
    const t3 = window.setTimeout(() => mathRef.current?.focus(), 120)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
      ro?.disconnect()
    }
  }, [resetToCalculate])

  return (
    <div
      ref={rootRef}
      className={`spotlight ${embedded ? 'spotlight-embedded' : ''}`}
      onMouseDown={(e) => {
        const t = e.target as HTMLElement
        if (t.closest('input, button, math-field, .tape, .quick-plain, .modes')) return
        nativeBridge()?.postMessage({ type: 'drag' })
        nativeBridge()?.postMessage('drag')
      }}
      onWheel={(e) => {
        if (!history.length) return
        if (e.deltaY < 0) setTapeOpen(true)
        const tape = tapeRef.current
        if (!tape) return
        if (tape.contains(e.target as Node)) return
        tape.scrollTop += e.deltaY
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
                title="Insert this answer at the cursor"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => useHistoryAnswer(i)}
              >
                {row.latex}
              </button>
              <button
                type="button"
                className="tape-a"
                title="Insert this answer at the cursor"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => useHistoryAnswer(i)}
              >
                {row.display}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="composer">
        <div className="modes">
          <button
            type="button"
            className={settings.angleMode === 'deg' ? 'active' : ''}
            title="Degrees"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setSettings((s) => ({ ...s, angleMode: 'deg' }))}
          >
            deg
          </button>
          <button
            type="button"
            className={settings.angleMode === 'rad' ? 'active' : ''}
            title="Radians"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setSettings((s) => ({ ...s, angleMode: 'rad' }))}
          >
            rad
          </button>
          <button
            type="button"
            className={settings.fractionMode ? 'active' : ''}
            title="Fraction results"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setSettings((s) => ({ ...s, fractionMode: !s.fractionMode }))}
          >
            a/b
          </button>
        </div>
        <QuickInput
          value={q}
          ansPlain={ansPlain}
          handleRef={mathRef}
          onChange={(text) => {
            setQ(text)
            if (selected != null && history[selected]?.latex !== text) setSelected(null)
          }}
          onEnter={onEnter}
          onUp={onUp}
          onDown={onDown}
        />
        <button
          type="button"
          className={`live ${copied ? 'copied' : ''} ${display ? '' : 'empty'}`}
          title={display ? 'Insert at cursor · ⌘C copies' : undefined}
          disabled={!display}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertAnswer(display, liveN)}
        >
          {copied ? 'copied' : display}
        </button>
      </div>
    </div>
  )
}

export { dismissNative }
