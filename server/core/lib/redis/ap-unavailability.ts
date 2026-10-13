import { sha256 } from '@peertube/peertube-node-utils'
import { AP_CLEANER } from '../../initializers/constants.js'
import { increment, setExpiration } from './redis-client.js'

export async function addAPUnavailability (url: string) {
  const key = generateAPUnavailabilityKey(url)

  const value = await increment(key)
  await setExpiration(key, AP_CLEANER.PERIOD * 2)

  return value
}

// ---------------------------------------------------------------------------

function generateAPUnavailabilityKey (url: string) {
  return 'ap-unavailability-' + sha256(url)
}
