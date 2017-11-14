import 'express-validator'
import 'multer'
import { CONFIG } from '../../initializers/constants'
import { exists } from './misc'

function isWebfingerResourceValid (value: string) {
  if (!exists(value)) return false
  if (value.startsWith('acct:') === false) return false

  const accountWithHost = value.substr(5)
  const accountParts = accountWithHost.split('@')
  if (accountParts.length !== 2) return false

  const host = accountParts[1]

  if (host !== CONFIG.WEBSERVER.HOST) return false

  return true
}

// ---------------------------------------------------------------------------

export {
  isWebfingerResourceValid
}
