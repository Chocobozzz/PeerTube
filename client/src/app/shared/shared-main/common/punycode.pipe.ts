import { Pipe, PipeTransform } from '@angular/core'

// Decode the punycode host of an actor handle: name@xn--fdivienne-b4a.org -> name@fédivienne.org
// Punycode is only used in domains, so the name part is not decoded
@Pipe({
  name: 'punycode',
  standalone: true
})
export class PunycodePipe implements PipeTransform {
  transform (handle: string): string {
    if (!handle) return handle

    const index = handle.lastIndexOf('@')
    if (index === -1) return handle

    const host = handle.substring(index + 1)
      .split('.')
      .map(label => decodeLabel(label))
      .join('.')

    return handle.substring(0, index + 1) + host
  }
}

// ---------------------------------------------------------------------------
// RFC 3492 decoder
// ---------------------------------------------------------------------------

const BASE = 36
const T_MIN = 1
const T_MAX = 26
const SKEW = 38
const DAMP = 700

function decodeLabel (label: string) {
  if (!label.toLowerCase().startsWith('xn--')) return label

  try {
    return decodePunycode(label.substring(4))
  } catch {
    return label
  }
}

function decodePunycode (input: string) {
  const output: number[] = []

  let n = 128
  let bias = 72
  let i = 0

  // Basic code points are before the last delimiter
  const basic = Math.max(input.lastIndexOf('-'), 0)
  for (let j = 0; j < basic; j++) {
    const code = input.charCodeAt(j)
    if (code >= 0x80) throw new Error('Invalid punycode basic code point')

    output.push(code)
  }

  for (let pos = basic > 0 ? basic + 1 : 0; pos < input.length;) {
    const oldI = i
    let w = 1

    for (let k = BASE; ; k += BASE) {
      if (pos >= input.length) throw new Error('Invalid punycode input')

      const digit = basicToDigit(input.charCodeAt(pos++))
      i += digit * w

      const t = k <= bias
        ? T_MIN
        : k >= bias + T_MAX ? T_MAX : k - bias

      if (digit < t) break

      w *= BASE - t
    }

    const length = output.length + 1

    bias = adapt(i - oldI, length, oldI === 0)
    n += Math.floor(i / length)
    i %= length

    output.splice(i, 0, n)
    i++
  }

  return String.fromCodePoint(...output)
}

function basicToDigit (code: number) {
  if (code >= 0x30 && code <= 0x39) return code - 0x16 // 0-9 -> 26-35
  if (code >= 0x41 && code <= 0x5a) return code - 0x41 // A-Z -> 0-25
  if (code >= 0x61 && code <= 0x7a) return code - 0x61 // a-z -> 0-25

  throw new Error('Invalid punycode digit')
}

function adapt (delta: number, numPoints: number, firstTime: boolean) {
  delta = firstTime ? Math.floor(delta / DAMP) : delta >> 1
  delta += Math.floor(delta / numPoints)

  let k = 0
  while (delta > ((BASE - T_MIN) * T_MAX) >> 1) {
    delta = Math.floor(delta / (BASE - T_MIN))
    k += BASE
  }

  return k + Math.floor((BASE - T_MIN + 1) * delta / (delta + SKEW))
}
