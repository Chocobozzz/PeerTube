import { REMOTE_ABUSES } from '../../initializers/constants.js'
import { incrementInWindow } from './redis-client.js'

export function incrementRemoteAbusesOfHost (host: string) {
  return incrementInWindow(`remote-abuses-${host}`, REMOTE_ABUSES.RATE_LIMIT_LIFETIME)
}
