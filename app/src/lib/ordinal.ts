const ONES = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
]
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const IRREGULAR: Record<string, string> = {
  one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth',
}

function ordinalWord(word: string) {
  if (IRREGULAR[word]) return IRREGULAR[word]
  if (word.endsWith('y')) return `${word.slice(0, -1)}ieth`
  return `${word}th`
}

/** 1 -> "first", 21 -> "twenty-first", 100 -> "one hundredth". Null outside 1-999. */
export function toOrdinalWords(n: number): string | null {
  if (!Number.isInteger(n) || n < 1 || n > 999) return null
  const words: string[] = []
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  if (hundreds) words.push(ONES[hundreds], 'hundred')
  if (rest && rest < 20) words.push(ONES[rest])
  else if (rest) words.push(ONES[rest % 10] ? `${TENS[Math.floor(rest / 10)]}-${ONES[rest % 10]}` : TENS[rest / 10])

  const last = words.pop()!
  const at = last.lastIndexOf('-') + 1
  words.push(last.slice(0, at) + ordinalWord(last.slice(at)))
  return words.join(' ')
}

/** "Quest the twelfth", or "Quest 1000" where there are no words for it. */
export const questKicker = (n: number) => {
  const words = toOrdinalWords(n)
  return words ? `Quest the ${words}` : `Quest ${n}`
}
