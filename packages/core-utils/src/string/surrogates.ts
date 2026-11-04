// Keep the first `end` UTF-16 code units of `str` (like `str.slice(0, end)`)
// The cut never lands inside a surrogate pair: an emoji that does not fit is completely dropped
export function sliceWithoutSplittingSurrogates (str: string, end: number) {
  if (end <= 0) return ''
  if (end >= str.length) return str

  // `end` is the length of the result, so its last character is at `end - 1`
  const last = str.charCodeAt(end - 1)
  const next = str.charCodeAt(end)

  const isHighSurrogate = last >= 0xD800 && last <= 0xDBFF
  const isLowSurrogate = next >= 0xDC00 && next <= 0xDFFF

  return isHighSurrogate && isLowSurrogate
    ? str.slice(0, end - 1)
    : str.slice(0, end)
}
