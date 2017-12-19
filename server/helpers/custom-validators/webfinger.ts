import { CONFIG } from '../../initializers'
import { exists } from './misc'

function isWebfingerResourceValid (value: string) {
  if (!exists(value)) return false
  if (value.startsWith('acct:') === false) return false

  const actorWithHost = value.substr(5)
  const actorParts = actorWithHost.split('@')
  if (actorParts.length !== 2) return false

  const host = actorParts[1]

  return host === CONFIG.WEBSERVER.HOSTNAME || host === CONFIG.WEBSERVER.HOST
}

// ---------------------------------------------------------------------------

export {
  isWebfingerResourceValid
}
