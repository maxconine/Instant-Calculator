export type ValueKind = 'number' | 'text'

export interface Value {
  kind: ValueKind
  n: number
  text?: string
}

export type LineKind = 'empty' | 'expression' | 'assignment'

export interface LineResult {
  raw: string
  kind: LineKind
  value?: Value
  display: string
  error?: string
  variable?: string
  tags: string[]
  dependsOn: string[]
}

export interface SheetInputLine {
  text: string
}

export interface EvaluateOptions {
  angleMode?: 'deg' | 'rad'
  ans?: number
  fractionMode?: boolean
}
