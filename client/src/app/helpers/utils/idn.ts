import punycode from 'punycode.js'
import { getBackendHost } from './url'

// Scripts we accept to display in their unicode form
// Characters of other scripts keep the host in its punycode form
const SCRIPTS = [
  'Latin',
  'Cyrillic',
  'Greek',
  'Armenian',
  'Georgian',
  'Hebrew',
  'Arabic',
  'Devanagari',
  'Bengali',
  'Gurmukhi',
  'Gujarati',
  'Tamil',
  'Telugu',
  'Kannada',
  'Malayalam',
  'Sinhala',
  'Thai',
  'Lao',
  'Khmer',
  'Myanmar',
  'Ethiopic',
  'Hangul',
  'Hiragana',
  'Katakana',
  'Bopomofo',
  'Han'
].map(name => ({
  name,
  regex: new RegExp(`\\p{Script=${name}}`, 'u'),
  extensionsRegex: new RegExp(`\\p{Script_Extensions=${name}}`, 'u')
}))

// Script mixes allowed by the "Highly Restrictive" level of UTS #39
const ALLOWED_SCRIPT_MIXES = [
  [ 'Latin', 'Han', 'Hiragana', 'Katakana' ],
  [ 'Latin', 'Han', 'Bopomofo' ],
  [ 'Latin', 'Han', 'Hangul' ]
]

// Letters that look like latin letters (inspired by Chromium IDN spoof checker)
// A label only made of them can impersonate a latin one
const WHOLE_SCRIPT_LOOKALIKES = [
  { script: 'Cyrillic', regex: /^[асԁеһіјӏорԛѕԝхуъьҽпгѵѡ0-9-]+$/u },
  { script: 'Greek', regex: /^[αγηικνορτυχωϲϳ0-9-]+$/u },
  { script: 'Armenian', regex: /^[ահոսցզօ0-9-]+$/u }
].map(({ script, regex }) => ({ regex, scriptRegex: new RegExp(`\\p{Script=${script}}`, 'u') }))

// Latin letters that look like ASCII ones but can't be decomposed into an ASCII letter and a mark
const LATIN_LOOKALIKES: { [char: string]: string } = {
  ɑ: 'a',
  ƀ: 'b',
  ɓ: 'b',
  đ: 'd',
  ð: 'd',
  ɗ: 'd',
  ɡ: 'g',
  ħ: 'h',
  ɦ: 'h',
  ı: 'i',
  ɨ: 'i',
  ɩ: 'i',
  ɪ: 'i',
  ȷ: 'j',
  ĸ: 'k',
  ł: 'l',
  ƚ: 'l',
  ɫ: 'l',
  ø: 'o',
  ɵ: 'o',
  ŧ: 't',
  ʋ: 'v',
  ƴ: 'y'
}

const NON_ASCII = /\P{ASCII}/u
const ALLOWED_CHARS = /^[\p{L}\p{M}\p{Nd}-]+$/u
const INVISIBLE_CHARS = /\p{Default_Ignorable_Code_Point}/u
const ASCII_DIGIT_OR_HYPHEN = /^[0-9-]$/
const COMMON = /\p{Script=Common}/u
const INHERITED = /\p{Script=Inherited}/u

// Decode a punycode host for display purpose
// Like web browsers, keep the punycode form if the unicode one could be used to impersonate another host
export function getDisplayHost (host: string, localHost = getBackendHost()) {
  if (!host || !/xn--/i.test(host)) return host

  const [ hostname, port ] = host.toLowerCase().split(':')
  const labels = hostname.split('.')

  try {
    const tld = punycode.toUnicode(labels[labels.length - 1])

    const decoded: string[] = []

    for (const label of labels) {
      if (!label.startsWith('xn--')) {
        decoded.push(label)
        continue
      }

      const unicode = punycode.toUnicode(label)
      if (!isDisplayableLabel({ ascii: label, unicode, tld })) return host

      decoded.push(unicode)
    }

    const result = decoded.join('.')

    // Don't display hosts that could be confused with the local one (framatübe.org vs framatube.org)
    const localHostname = localHost?.toLowerCase().split(':')[0]
    if (localHostname && hostname !== localHostname && getSkeleton(result) === getLocalSkeleton(localHostname)) return host

    return port
      ? result + ':' + port
      : result
  } catch {
    return host
  }
}

// Decode the punycode host of an actor handle: name@xn--fdivienne-b4a.org -> name@fédivienne.org
// Punycode is only used in domains, so the name part is not decoded
export function getDisplayHandle (handle: string, localHost = getBackendHost()) {
  if (!handle) return handle

  const index = handle.lastIndexOf('@')
  if (index === -1) return handle

  return handle.substring(0, index + 1) + getDisplayHost(handle.substring(index + 1), localHost)
}

// ---------------------------------------------------------------------------

function isDisplayableLabel (options: {
  ascii: string
  unicode: string
  tld: string
}) {
  const { ascii, unicode, tld } = options

  // Reject fake A-labels (xn--framatube-) and invalid chars
  if (!NON_ASCII.test(unicode)) return false
  if (punycode.toASCII(unicode) !== ascii) return false
  if (!ALLOWED_CHARS.test(unicode)) return false
  if (INVISIBLE_CHARS.test(unicode)) return false

  // Reject chars that IDNA would have mapped (uppercase, fullwidth, ligatures...)
  if (unicode.toLowerCase().normalize('NFKC') !== unicode) return false

  // Reject mixed scripts (frаmatube.org with a cyrillic "а")
  const scripts = new Set<string>()

  for (const char of unicode) {
    if (ASCII_DIGIT_OR_HYPHEN.test(char)) continue

    // Combining marks take the script of their base char
    if (INHERITED.test(char)) continue

    // Common chars (like the japanese prolonged sound mark "ー") are only allowed if used by an accepted script
    const charScripts = COMMON.test(char)
      ? SCRIPTS.filter(s => s.extensionsRegex.test(char))
      : SCRIPTS.filter(s => s.regex.test(char))

    if (charScripts.length === 0) return false

    for (const s of charScripts) {
      scripts.add(s.name)
    }
  }

  if (scripts.size > 1 && !ALLOWED_SCRIPT_MIXES.some(mix => [ ...scripts ].every(s => mix.includes(s)))) return false

  // Reject whole-script confusables (раураl.com in cyrillic)
  if (WHOLE_SCRIPT_LOOKALIKES.some(({ regex, scriptRegex }) => regex.test(unicode) && !scriptRegex.test(tld))) return false

  return true
}

let localSkeleton: { hostname: string, skeleton: string }

function getLocalSkeleton (hostname: string) {
  if (localSkeleton?.hostname !== hostname) {
    localSkeleton = { hostname, skeleton: getSkeleton(punycode.toUnicode(hostname)) }
  }

  return localSkeleton.skeleton
}

function getSkeleton (str: string) {
  return Array.from(str.normalize('NFD').replace(/\p{M}/gu, ''))
    .map(char => LATIN_LOOKALIKES[char] ?? char)
    .join('')
}
