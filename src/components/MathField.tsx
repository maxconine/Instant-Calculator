import { useEffect, useRef, type MutableRefObject } from 'react'
import { MathfieldElement } from 'mathlive'
import { applyInlineShortcuts, readLatex, rememberMathField } from '../lib/mathfield'

export interface MathFieldHandle {
  insert: (latex: string) => void
  focus: () => void
  setValue: (latex: string) => void
  element: () => MathfieldElement | null
}

interface Props {
  value: string
  ansLatex?: string
  onChange: (latex: string) => void
  onEnter: () => void
  onUp: () => boolean
  onDown: () => boolean
  onReady?: (el: MathfieldElement) => void
  handleRef?: MutableRefObject<MathFieldHandle | null>
}

export function MathField({ value, ansLatex = 'ans', onChange, onEnter, onUp, onDown, onReady, handleRef }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const field = useRef<MathfieldElement | null>(null)
  const onChangeRef = useRef(onChange)
  const onEnterRef = useRef(onEnter)
  const onUpRef = useRef(onUp)
  const onDownRef = useRef(onDown)
  const onReadyRef = useRef(onReady)
  onChangeRef.current = onChange
  onEnterRef.current = onEnter
  onUpRef.current = onUp
  onDownRef.current = onDown
  onReadyRef.current = onReady

  useEffect(() => {
    if (!host.current || field.current) return
    const mf = new MathfieldElement()
    mf.mathVirtualKeyboardPolicy = 'manual'
    mf.smartMode = false
    mf.smartFence = true
    mf.smartSuperscript = true
    mf.inlineShortcutTimeout = 500
    mf.defaultMode = 'math'
    host.current.appendChild(mf)
    field.current = mf
    applyInlineShortcuts(mf, ansLatex)
    mf.placeholder = 'Calculate'
    if (value) mf.value = value
    rememberMathField(mf)

    const emit = () => onChangeRef.current(readLatex(mf))
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault()
        e.stopPropagation()
        onEnterRef.current()
        return
      }
      if (e.key === 'ArrowUp' && onUpRef.current()) {
        e.preventDefault()
        e.stopPropagation()
        return
      }
      if (e.key === 'ArrowDown' && onDownRef.current()) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    const api: MathFieldHandle = {
      insert: (latex: string) => {
        mf.focus()
        mf.insert(latex, { focus: true, feedback: false, mode: 'math', selectionMode: 'after' })
        emit()
      },
      focus: () => {
        try {
          mf.focus()
        } catch {
          /* not connected */
        }
      },
      setValue: (latex: string) => {
        mf.setValue(latex, { silenceNotifications: true })
      },
      element: () => mf,
    }
    if (handleRef) handleRef.current = api

    mf.addEventListener('input', emit)
    mf.addEventListener('change', emit)
    mf.addEventListener('keydown', onKey)
    mf.addEventListener('focusin', () => rememberMathField(mf))
    const timers = [
      window.setTimeout(() => api.focus(), 0),
      window.setTimeout(() => api.focus(), 16),
      window.setTimeout(() => api.focus(), 80),
      window.setTimeout(() => onReadyRef.current?.(mf), 0),
    ]

    return () => {
      for (const t of timers) window.clearTimeout(t)
      mf.removeEventListener('input', emit)
      mf.removeEventListener('change', emit)
      mf.removeEventListener('keydown', onKey)
      mf.remove()
      field.current = null
      if (handleRef) handleRef.current = null
    }
    // created once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const mf = field.current
    if (!mf) return
    applyInlineShortcuts(mf, ansLatex)
  }, [ansLatex])

  useEffect(() => {
    const mf = field.current
    if (!mf) return
    if (document.activeElement === mf) return
    if (value !== readLatex(mf)) mf.setValue(value, { silenceNotifications: true })
  }, [value])

  return <div className="math-host" ref={host} />
}
