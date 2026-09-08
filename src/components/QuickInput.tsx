import { useEffect, useRef, type KeyboardEvent, type MutableRefObject } from 'react'

export interface QuickInputHandle {
  insert: (chunk: string) => void
  focus: () => void
  setValue: (text: string) => void
  element: () => HTMLInputElement | null
}

interface Props {
  value: string
  ansPlain?: string
  onChange: (text: string) => void
  onEnter: () => void
  onUp: () => boolean
  onDown: () => boolean
  handleRef?: MutableRefObject<QuickInputHandle | null>
}

const TOKEN_REPLACEMENTS: [RegExp, string][] = [
  [/\bpi\b/gi, 'π'],
  [/\btheta\b/gi, 'θ'],
  [/\binfty\b/gi, '∞'],
  [/\binf\b/gi, '∞'],
  [/\bsqrt\b/gi, '√'],
  [/\bcbrt\b/gi, '∛'],
]

function prettyTokens(text: string, ansPlain?: string): string {
  let out = text
  for (const [re, put] of TOKEN_REPLACEMENTS) {
    re.lastIndex = 0
    out = out.replace(re, put)
  }
  if (ansPlain) out = out.replace(/\bans\b/gi, ansPlain)
  return out
}

export function QuickInput({ value, ansPlain, onChange, onEnter, onUp, onDown, handleRef }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const onChangeRef = useRef(onChange)
  const onEnterRef = useRef(onEnter)
  const onUpRef = useRef(onUp)
  const onDownRef = useRef(onDown)
  const ansRef = useRef(ansPlain)
  onChangeRef.current = onChange
  onEnterRef.current = onEnter
  onUpRef.current = onUp
  onDownRef.current = onDown
  ansRef.current = ansPlain

  const commit = (raw: string, cursor: number) => {
    const before = prettyTokens(raw.slice(0, cursor), ansRef.current)
    const next = prettyTokens(raw, ansRef.current)
    onChangeRef.current(next)
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      const pos = Math.min(before.length, next.length)
      el.setSelectionRange(pos, pos)
    })
  }

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    const api: QuickInputHandle = {
      insert: (chunk: string) => {
        el.focus()
        const start = el.selectionStart ?? el.value.length
        const end = el.selectionEnd ?? start
        const raw = el.value.slice(0, start) + chunk + el.value.slice(end)
        commit(raw, start + chunk.length)
      },
      focus: () => el.focus(),
      setValue: (text: string) => {
        el.focus()
        onChangeRef.current(text)
        requestAnimationFrame(() => {
          el.setSelectionRange(text.length, text.length)
        })
      },
      element: () => el,
    }
    if (handleRef) handleRef.current = api
    const w = window as Window & { __instantFocus?: () => void; __INSTANT_KEYS?: string[] }
    w.__instantFocus = () => el.focus()
    const buffered = w.__INSTANT_KEYS
    if (buffered?.length) {
      commit((el.value || '') + buffered.join(''), ((el.value || '') + buffered.join('')).length)
      w.__INSTANT_KEYS = []
    }
    const timers = [0, 40, 120, 280].map((ms) => window.setTimeout(() => el.focus(), ms))
    return () => {
      for (const t of timers) window.clearTimeout(t)
      if (handleRef) handleRef.current = null
    }
    // created once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onEnterRef.current()
      return
    }
    if (e.key === 'ArrowUp' && onUpRef.current()) {
      e.preventDefault()
      return
    }
    if (e.key === 'ArrowDown' && onDownRef.current()) {
      e.preventDefault()
    }
  }

  return (
    <input
      ref={inputRef}
      className="quick-plain"
      value={value}
      autoFocus
      autoCapitalize="off"
      autoCorrect="off"
      autoComplete="off"
      spellCheck={false}
      placeholder="Calculate"
      onChange={(e) => {
        const el = e.currentTarget
        commit(el.value, el.selectionStart ?? el.value.length)
      }}
      onKeyDown={onKeyDown}
    />
  )
}
