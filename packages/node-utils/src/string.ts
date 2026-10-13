/**
 * Truncate a string to `length` characters, ending it with `omission` when it does not fit.
 *
 * Reimplements the `truncate` of lodash with some differences:
 *  * lodash counts Unicode symbols where this implementation uses counts UTF-16 code units (using .length)
 *  * the cut never lands inside a surrogate pair, so an emoji is completely dropped
 */
export function peertubeTruncate (str: string, options: {
  length: number
  separator?: RegExp
  omission?: string
}) {
  const { length, separator } = options
  const omission = options.omission ?? '...'

  if (str.length <= length) return str

  const end = length - omission.length
  if (end < 1) return omission

  let result = str.slice(0, avoidSurrogateSplit(str, end))

  // Nothing to move back when the remainder already starts on a separator
  if (separator !== undefined) {
    const removedPart = str.slice(result.length)

    if (!startsWithSeparator(removedPart, separator)) {
      const index = lastSeparatorIndex(result, separator)

      if (index !== -1) result = result.slice(0, index)
    }
  }

  return result + omission
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function avoidSurrogateSplit (str: string, end: number) {
  // `end` is the length of the truncated string, so its last character is at `end - 1`
  const last = str.charCodeAt(end - 1)
  const next = str.charCodeAt(end)

  const isHighSurrogate = last >= 0xD800 && last <= 0xDBFF
  const isLowSurrogate = next >= 0xDC00 && next <= 0xDFFF

  return isHighSurrogate && isLowSurrogate
    ? end - 1
    : end
}

function startsWithSeparator (rest: string, separator: RegExp) {
  return rest.search(separator) === 0
}

function lastSeparatorIndex (str: string, separator: RegExp) {
  // Copy regex to use our own regexp internal state
  const global = new RegExp(
    separator.source,
    separator.flags.includes('g')
      ? separator.flags
      : separator.flags + 'g'
  )

  let index = -1
  let match: RegExpExecArray

  while ((match = global.exec(str)) !== null) {
    index = match.index

    // Workaround when there's an empty match (for example `/\b/`, `/x*/` regexp)
    // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec#finding_successive_matches
    if (match[0].length === 0) global.lastIndex++
  }

  return index
}
