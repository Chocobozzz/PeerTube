import { ActivityType } from '@peertube/peertube-models'
import { deleteHashFields, deleteKey, getHash, incrementHashField, setHashField } from './redis-client.js'

const STATS_KEY = 'ap-inbox-stats'
const WAITING_KEY = 'ap-inbox-waiting'

// ---------------------------------------------------------------------------
// Processed activities, since the start of the primary
// ---------------------------------------------------------------------------

export async function resetInboxStats (startedAt: number) {
  await deleteKey(STATS_KEY)
  await setHashField(STATS_KEY, 'startedAt', startedAt)
}

export function addInboxProcessed (type: ActivityType, success: boolean) {
  const field = success
    ? 'successes-' + type
    : 'errors-' + type

  return incrementHashField(STATS_KEY, field)
}

export async function getInboxStats () {
  const hash = await getHash(STATS_KEY)

  const successesPerType: { [id in ActivityType]?: number } = {}
  const errorsPerType: { [id in ActivityType]?: number } = {}

  for (const [ field, value ] of Object.entries(hash)) {
    if (field.startsWith('successes-')) successesPerType[field.substring('successes-'.length)] = parseInt(value, 10)
    else if (field.startsWith('errors-')) errorsPerType[field.substring('errors-'.length)] = parseInt(value, 10)
  }

  const startedAt = hash.startedAt
    ? parseInt(hash.startedAt, 10)
    : undefined

  return { startedAt, successesPerType, errorsPerType }
}

// ---------------------------------------------------------------------------

export function setInboxWaiting (processId: string, waiting: number) {
  return setHashField(WAITING_KEY, processId, `${waiting}:${Date.now()}`)
}

export async function removeInboxWaiting (processId: string) {
  await deleteHashFields(WAITING_KEY, [ processId ])
}

export async function getInboxWaiting (staleAfterMs: number) {
  const hash = await getHash(WAITING_KEY)

  const staleProcessIds: string[] = []
  let total = 0

  for (const [ processId, value ] of Object.entries(hash)) {
    const [ waiting, updatedAt ] = value.split(':').map(v => parseInt(v, 10))

    // Ignore stale processes
    if (isNaN(updatedAt) || Date.now() - updatedAt > staleAfterMs) {
      staleProcessIds.push(processId)
      continue
    }

    total += waiting
  }

  if (staleProcessIds.length !== 0) await deleteHashFields(WAITING_KEY, staleProcessIds)

  return total
}
