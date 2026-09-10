import { describe, expect, it } from 'vitest'
import { evaluateLine } from './evaluate'
import { fillParens } from './parens'

type Case = { name: string; input: string; filled: string }

function suite(title: string, cases: Case[]) {
  describe(title, () => {
    it.each(cases)('$name', ({ input, filled }) => {
      expect(fillParens(input), input).toBe(filled)
    })
  })
}

suite('Auto-Prepend Opening Parentheses (Leading Missing ()', [
  { name: 'TC-01 Mid-expression closing parenthesis prepends ( to start', input: '5 + 3) * 2', filled: '(5 + 3) * 2' },
  { name: 'TC-02 Trailing closing parenthesis prepends ( to start', input: '100 / 2 + 5)', filled: '(100 / 2 + 5)' },
  { name: 'TC-03 Exponentiation before excess closing parenthesis', input: '4^2) - 1', filled: '(4^2) - 1' },
  { name: 'TC-04 Closing parenthesis placed at character index 0', input: ')5 + 3(', filled: '()5 + 3()' },
  { name: 'TC-05 Implicit multiplication immediately following excess )', input: '300 * 9)2', filled: '(300 * 9)2' },
  { name: 'TC-06 Prepend ( before first operand when operator follows )', input: '10 + 20) / 5', filled: '(10 + 20) / 5' },
  { name: 'TC-07 Prepend ( across multi-term expressions', input: '1 + 2) * 3 + 4', filled: '(1 + 2) * 3 + 4' },
  { name: 'TC-08 Decimal numbers inside prepended group', input: '0.5 + 2.5) * 4', filled: '(0.5 + 2.5) * 4' },
  { name: 'TC-09 Unary negative operand inside prepended group', input: '2 * -3)', filled: '(2 * -3)' },
  { name: 'TC-10 Postfix percentage symbol immediately after excess )', input: '100)%', filled: '(100)%' },
])

suite('Auto-Append Closing Parentheses (Trailing Missing ))', [
  { name: 'TC-11 Single unclosed ( at start appends ) at end', input: '(300 * 9', filled: '(300 * 9)' },
  { name: 'TC-12 Unclosed ( mid-expression appends ) at end', input: '2 * (5 + 3', filled: '2 * (5 + 3)' },
  { name: 'TC-13 Unclosed ( spanning multiple arithmetic operations', input: '(10 + 20 / 5', filled: '(10 + 20 / 5)' },
  { name: 'TC-14 First group balanced, second group appends trailing )', input: '(4 + 5) * (2 + 3', filled: '(4 + 5) * (2 + 3)' },
  { name: 'TC-15 Unclosed denominator group appends ) at end', input: '10 / (2 + 3', filled: '10 / (2 + 3)' },
  { name: 'TC-16 Unclosed group containing floating-point numbers', input: '(0.5 + 0.25', filled: '(0.5 + 0.25)' },
  { name: 'TC-17 Unclosed group starting with unary minus', input: '(-5 + 3', filled: '(-5 + 3)' },
  { name: 'TC-18 Unclosed group containing exponents', input: '(2^3 + 1', filled: '(2^3 + 1)' },
  { name: 'TC-19 Term-level unclosed opening parenthesis', input: '100 + (200', filled: '100 + (200)' },
  { name: 'TC-20 Unclosed ( at terminal position appends )', input: '(3 + 4) * (', filled: '(3 + 4) * ()' },
])

suite('Bidirectional Auto-Fill (Simultaneous Prepend & Append)', [
  { name: 'TC-21 Prepends leading ( for early ) AND appends trailing ) for late (', input: '3 + 4) * 2 + (5', filled: '(3 + 4) * 2 + (5)' },
  { name: 'TC-22 Single operand prepended, separate term appended', input: '5) * 2 + (3', filled: '(5) * 2 + (3)' },
  { name: 'TC-23 Division block prepended, multiplication block appended', input: '50 / 2) + 10 * (3', filled: '(50 / 2) + 10 * (3)' },
  { name: 'TC-24 Adjacent grouped factors balanced at both outer edges', input: '1 + 2) * (3 + 4', filled: '(1 + 2) * (3 + 4)' },
  { name: 'TC-25 Prepend ( at index 0, append ) at terminal end', input: '10) + 20 * (5 + 2', filled: '(10) + 20 * (5 + 2)' },
  { name: 'TC-26 Middle pair balanced; leading prepended and trailing appended', input: '2) * (3) + (4', filled: '(2) * (3) + (4)' },
  { name: 'TC-27 Prepend around numerator, append around denominator', input: '100) / (2 + 3', filled: '(100) / (2 + 3)' },
  { name: 'TC-28 Asymmetric operators with bidirectional missing bounds', input: '4) + 5 * (6', filled: '(4) + 5 * (6)' },
  { name: 'TC-29 Decimal expressions with bidirectional bounds', input: '0.5) * (1.5', filled: '(0.5) * (1.5)' },
  { name: 'TC-30 Leading term requires (, trailing term requires )', input: '8) + (2 * 3', filled: '(8) + (2 * 3)' },
])

suite('Deep Nesting & Multiple Missing Parentheses (Depth |Δ| > 1)', [
  { name: 'TC-31 Depth -2: Prepends (( at start', input: '3 + 4))', filled: '((3 + 4))' },
  { name: 'TC-32 Depth -3: Prepends ((( at start', input: '1 + 2)))', filled: '(((1 + 2)))' },
  { name: 'TC-33 Depth +2: Appends )) at end', input: '((10 + 20', filled: '((10 + 20))' },
  { name: 'TC-34 Depth +3: Appends ))) at end', input: '(((3 + 4', filled: '(((3 + 4)))' },
  { name: 'TC-35 Cumulative depth reaching -3 across multiple terms', input: '1 + 2)) * 3 + 4)', filled: '(((1 + 2)) * 3 + 4)' },
  { name: 'TC-36 Nested opening parentheses needing 3 closing parens at end', input: '((1 + (2 + 3', filled: '((1 + (2 + 3)))' },
  { name: 'TC-37 Depth -2 early, depth +1 late', input: '100)) + 2 * (5', filled: '((100)) + 2 * (5)' },
  { name: 'TC-38 Inner pair balanced, outer net depth prepends ( and appends )', input: '(1 + 2)) * (3 + 4', filled: '((1 + 2)) * (3 + 4)' },
  { name: 'TC-39 Deeply nested group missing 2 opening parentheses at start', input: '((3 + 4) * 2)))', filled: '((((3 + 4) * 2)))' },
  { name: 'TC-40 Partially closed nest (depth +1 remaining) appends single )', input: '(((1 + 2))', filled: '(((1 + 2)))' },
])

suite('Functions & Implicit Multiplication', [
  { name: 'TC-41 Function parens balanced internally, excess outer ) prepends (', input: 'sin(30)) + 1', filled: '(sin(30)) + 1' },
  { name: 'TC-42 Unclosed function argument auto-appends )', input: 'sin(30 + 10', filled: 'sin(30 + 10)' },
  { name: 'TC-43 Implicit multiplication before unclosed paren appends )', input: '2(3 + 4', filled: '2(3 + 4)' },
  { name: 'TC-44 Prepend ( to entire expression containing standard function call', input: 'sqrt(16) / 2)', filled: '(sqrt(16) / 2)' },
  { name: 'TC-45 Closed function followed by unclosed term appends )', input: 'log(100) + (5 * 2', filled: 'log(100) + (5 * 2)' },
  { name: 'TC-51 Unclosed log argument auto-appends )', input: 'log(2', filled: 'log(2)' },
  { name: 'TC-52 Unclosed sqrt argument auto-appends )', input: 'sqrt(2', filled: 'sqrt(2)' },
  { name: 'TC-53 Unclosed ln argument auto-appends )', input: 'ln(2', filled: 'ln(2)' },
])

suite('Boundary Conditions, Special Symbols & Control Cases', [
  { name: 'TC-46 Standalone closing parenthesis prepends (', input: ')', filled: '()' },
  { name: 'TC-47 Standalone opening parenthesis appends )', input: '(', filled: '()' },
  { name: 'TC-48 Isolated unmatched parens auto-fill into two empty groups', input: ') + (', filled: '() + ()' },
  { name: 'TC-49 Control: Valid expression without parens remains unchanged', input: '300 * 9', filled: '300 * 9' },
  { name: 'TC-50 Control: Fully balanced expression remains unchanged', input: '(300 * 9)', filled: '(300 * 9)' },
])

describe('Inferred parens evaluate', () => {
  it('evaluates 300*9)2 as (300*9)2', () => {
    expect(evaluateLine('300*9)2').value?.n).toBe(5400)
    expect(evaluateLine('300 * 9)2').value?.n).toBe(5400)
  })

  it('evaluates prepended and appended groups', () => {
    expect(evaluateLine('5 + 3) * 2').value?.n).toBe(16)
    expect(evaluateLine('100 / 2 + 5)').value?.n).toBe(55)
    expect(evaluateLine('(300 * 9').value?.n).toBe(2700)
    expect(evaluateLine('2 * (5 + 3').value?.n).toBe(16)
    expect(evaluateLine('1 + 2) * (3 + 4').value?.n).toBe(21)
    expect(evaluateLine('sin(30)) + 1').value?.n).toBe(1.5)
    expect(evaluateLine('log(2').value?.n).toBeCloseTo(Math.log10(2), 8)
    expect(evaluateLine('sqrt(2').value?.n).toBeCloseTo(Math.sqrt(2), 8)
    expect(evaluateLine('ln(2').value?.n).toBeCloseTo(Math.log(2), 8)
  })

  it('leaves already-valid expressions unchanged', () => {
    expect(evaluateLine('300 * 9').value?.n).toBe(2700)
    expect(evaluateLine('(300 * 9)').value?.n).toBe(2700)
    expect(evaluateLine('(5 + 3) * 4').value?.n).toBe(32)
  })
})
