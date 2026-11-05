// On non-latin keyboard layouts (cyrillic, greek, arabic, thai...), get the latin letter or digit of the physical key
// Returns undefined if the key doesn't need to be remapped
export function getPhysicalLatinKey (key: string, code: string) {
  // Use the code point count, so letters outside the BMP (adlam...) are remapped too
  if ([ ...key ].length !== 1) return undefined

  // Include marks (thai, devanagari...) and digits (arabic-indic...) typed by letter/digit keys
  if (!/^[\p{L}\p{M}\p{N}]$/u.test(key)) return undefined
  if (/^[\p{Script=Latin}\p{ASCII}]$/u.test(key)) return undefined

  const physical = /^(?:Key([A-Z])|Digit(\d))$/.exec(code)
  if (!physical) return undefined

  return physical[1] ?? physical[2]
}

export function getLatinKey (key: string, code: string) {
  const physicalKey = getPhysicalLatinKey(key, code)
  if (physicalKey) return physicalKey

  if ([ ...key ].length !== 1) return key

  return key.toUpperCase()
}
