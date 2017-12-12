import { CONFIG } from '../../initializers'
import { exists } from './misc'

function isWebfingerResourceValid (value: string) {
  if (!exists(value)) return false
  if (value.startsWith('acct:') === false) return false

  const accountWithHost = value.substr(5)
  const accountParts = accountWithHost.split('@')
  if (accountParts.length !== 2) return false

  const host = accountParts[1]

  return host === CONFIG.WEBSERVER.HOST
}

// ---------------------------------------------------------------------------

export {
  isWebfingerResourceValid
}
