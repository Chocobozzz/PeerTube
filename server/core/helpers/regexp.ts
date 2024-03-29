// Thanks to https://regex101.com
export function regexpCapture (str: string, regex: RegExp, maxIterations = 100) {
  const result: RegExpExecArray[] = []
  let m: RegExpExecArray
  let i = 0

  while ((m = regex.exec(str)) !== null && i < maxIterations) {
    // This is necessary to avoid infinite loops with zero-width matches
    if (m.index === regex.lastIndex) {
      regex.lastIndex++
    }

    result.push(m)
    i++
  }

  return result
}

export function wordsToRegExp (words: string[]) {
  if (words.length === 0) throw new Error('Need words with at least one element')

  const innerRegex = words
    .map(word => escapeForRegex(word.trim()))
    .join('|')

  return new RegExp(`(?:\\P{L}|^)(?:${innerRegex})(?=\\P{L}|$)`, 'iu')
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function escapeForRegex (value: string) {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
}
