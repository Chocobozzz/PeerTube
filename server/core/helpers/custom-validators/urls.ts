import { exists } from '@peertube/peertube-core-utils'
import { CONFIG } from '@server/initializers/config.js'
import { CONSTRAINTS_FIELDS } from '@server/initializers/constants.js'
import validator from 'validator'

export function isWebSocketTrackerUrl (url: string) {
  return url.startsWith('ws://') || url.startsWith('wss://')
}

export function isTrackerUrlValid (url: string) {
  return isUrlWithProtocolsValid(url, [ 'ws', 'wss', 'http', 'https' ]) &&
    validator.default.isLength('' + url, CONSTRAINTS_FIELDS.ACTORS.URL)
}
export function isUrlValid (url: string) {
  return isUrlWithProtocolsValid(url, [ 'http', 'https' ])
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function isUrlWithProtocolsValid (url: string, protocols: string[]) {
  const isURLOptions = {
    require_host: true,
    require_tld: true,
    require_protocol: true,
    require_valid_protocol: true,
    protocols
  }

  // We validate 'localhost', so we don't have the top level domain
  if (CONFIG.WEBSERVER.HOSTNAME === 'localhost' || CONFIG.WEBSERVER.HOSTNAME === '127.0.0.1') {
    isURLOptions.require_tld = false
  }

  return exists(url) && validator.default.isURL('' + url, isURLOptions)
}
