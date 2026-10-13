import { getValueAndExpiration, removeValue, runIncrementRateLimit } from './redis-client.js'

// Counters shared by every process of the platform
// msBeforeReset is negative if the counter has been removed because it has no hits anymore
export async function incrementRateLimit (options: {
  key: string
  hits: number
  windowMs: number
}) {
  const { key, hits, windowMs } = options

  const [ totalHits, msBeforeReset ] = await runIncrementRateLimit({ key: generateRateLimitKey(key), hits, windowMs })

  return { totalHits, msBeforeReset }
}

// Returns undefined if the window has reset
export async function getRateLimit (key: string) {
  const { value, msBeforeExpiration } = await getValueAndExpiration(generateRateLimitKey(key))
  if (value === null || msBeforeExpiration < 0) return undefined

  return { totalHits: parseInt(value, 10), msBeforeReset: msBeforeExpiration }
}

export function resetRateLimit (key: string) {
  return removeValue(generateRateLimitKey(key))
}

// ---------------------------------------------------------------------------

function generateRateLimitKey (key: string) {
  return 'rate-limit-' + key
}
