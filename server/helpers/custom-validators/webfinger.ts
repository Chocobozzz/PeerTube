import { CONFIG, REMOTE_SCHEME } from '../../initializers'
import { sanitizeHost } from '../core-utils'
import { exists } from './misc'

function isWebfingerLocalResourceValid (value: string) {
  if (!exists(value)) return false
  if (value.startsWith('acct:') === false) return false

  const actorWithHost = value.substr(5)
  const actorParts = actorWithHost.split('@')
  if (actorParts.length !== 2) return false

  const host = actorParts[1]
  return sanitizeHost(host, REMOTE_SCHEME.HTTP) === CONFIG.WEBSERVER.HOST
}

// ---------------------------------------------------------------------------

export {
  isWebfingerLocalResourceValid
}
