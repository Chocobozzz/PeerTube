export function getLatinKey (key: string, code: string) {
  if (key.length !== 1) {
    return key
  }

  if (/^\p{L}$/u.test(key) && !/^\p{Script=Latin}$/u.test(key)) {
    const physical = /^(?:Key([A-Z])|Digit(\d))$/.exec(code)
    if (physical) return physical[1] ?? physical[2]
  }

  return key.toUpperCase()
}
