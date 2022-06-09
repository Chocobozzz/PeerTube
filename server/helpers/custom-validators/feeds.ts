import { exists } from './misc'

function isValidRSSFeed (value: string) {
  if (!exists(value)) return false

  const feedExtensions = [
    'xml',
    'json',
    'json1',
    'rss',
    'rss2',
    'atom',
    'atom1',
    'podcast'
  ]

  const isValid = feedExtensions.includes(value)

  return isValid
}

// ---------------------------------------------------------------------------

export {
  isValidRSSFeed
}
