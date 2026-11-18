import { describe, expect, it } from 'vitest'
import {
  applyBasisPoints,
  centsToDecimalString,
  formatBasisPoints,
  formatCents,
  parseMoneyToCents,
  parsePercentToBasisPoints
} from '../src/shared/money'

describe('money helpers', () => {
  it('formats cents as USD', () => {
    expect(formatCents(0)).toBe('$0.00')
    expect(formatCents(5)).toBe('$0.05')
    expect(formatCents(1080)).toBe('$10.80')
    expect(formatCents(123456789)).toBe('$1,234,567.89')
    expect(formatCents(-250)).toBe('-$2.50')
    expect(centsToDecimalString(1080)).toBe('10.80')
  })

  it('parses typed amounts without floating point', () => {
    expect(parseMoneyToCents('20')).toBe(2000)
    expect(parseMoneyToCents('0.1')).toBe(10)
    expect(parseMoneyToCents('$1,234.56')).toBe(123456)
    expect(parseMoneyToCents('.5')).toBe(50)
    expect(parseMoneyToCents('19.99')).toBe(1999)
    // 0.1 + 0.2 style bugs can't happen: each value is parsed from digits
    expect(parseMoneyToCents('0.10')! + parseMoneyToCents('0.20')!).toBe(30)
    for (const bad of ['', 'abc', '1.234', '-5', '1.2.3', '.']) expect(parseMoneyToCents(bad)).toBeNull()
  })

  it('parses and formats percentages as basis points', () => {
    expect(parsePercentToBasisPoints('10')).toBe(1000)
    expect(parsePercentToBasisPoints('8.25%')).toBe(825)
    expect(parsePercentToBasisPoints('12.5')).toBe(1250)
    expect(parsePercentToBasisPoints('1.234')).toBeNull()
    expect(formatBasisPoints(1000)).toBe('10')
    expect(formatBasisPoints(825)).toBe('8.25')
    expect(formatBasisPoints(1250)).toBe('12.5')
  })

  it('rounds percentage amounts half-up in integer math', () => {
    expect(applyBasisPoints(1175, 1000)).toBe(118) // 117.5 -> 118
    expect(applyBasisPoints(1174, 1000)).toBe(117) // 117.4 -> 117
    expect(applyBasisPoints(999, 825)).toBe(82) // 82.4175 -> 82
    expect(applyBasisPoints(0, 1000)).toBe(0)
    expect(() => applyBasisPoints(10.5, 1000)).toThrow()
  })
})
