import { describe, expect, it } from 'vitest'
import { questKicker, toOrdinalWords } from './ordinal'

describe('toOrdinalWords', () => {
  it.each([
    [1, 'first'],
    [2, 'second'],
    [3, 'third'],
    [11, 'eleventh'],
    [12, 'twelfth'],
    [13, 'thirteenth'],
    [20, 'twentieth'],
    [21, 'twenty-first'],
    [99, 'ninety-ninth'],
    [100, 'one hundredth'],
    [101, 'one hundred first'],
    [112, 'one hundred twelfth'],
    [999, 'nine hundred ninety-ninth'],
  ])('%i -> %s', (n, words) => {
    expect(toOrdinalWords(n)).toBe(words)
  })

  it('has no words outside 1-999', () => {
    expect(toOrdinalWords(0)).toBeNull()
    expect(toOrdinalWords(1000)).toBeNull()
  })
})

describe('questKicker', () => {
  it('uses words, then falls back to the number', () => {
    expect(questKicker(12)).toBe('Quest the twelfth')
    expect(questKicker(1000)).toBe('Quest 1000')
  })
})
