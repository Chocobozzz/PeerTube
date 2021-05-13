import { exists } from './misc'

/**
 * @throws {Error}
 */
function checkRSSFeedFormat (value: string) {
  if (!exists(value)) throw new Error('Should have a format')

  const feedExtensions = [
    'xml',
    'json',
    'json1',
    'rss',
    'rss2',
    'atom',
    'atom1'
  ]

  if (!feedExtensions.includes(value)) throw new Error('Should have a feed format among ' + feedExtensions.join(', '))
  return true
}

// ---------------------------------------------------------------------------

export {
  checkRSSFeedFormat
}
