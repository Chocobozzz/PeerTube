import { ProcessRole } from '@peertube/peertube-models'
import { createLogger } from '../../helpers/logger.js'
import { deleteHashFields, getHash, setHashField } from './redis-client.js'

const logger = createLogger('redis')

const HEARTBEATS_KEY = 'process-heartbeats'

export type ProcessHeartbeat = {
  role: ProcessRole
  hostname: string
  pid: number
  version: string

  startedAt: number
  lastSeenAt: number
}

export function setProcessHeartbeat (processId: string, heartbeat: ProcessHeartbeat) {
  return setHashField(HEARTBEATS_KEY, processId, JSON.stringify(heartbeat))
}

export async function removeProcessHeartbeat (processId: string) {
  await deleteHashFields(HEARTBEATS_KEY, [ processId ])
}

export async function getProcessHeartbeats (staleAfterMs: number) {
  const hash = await getHash(HEARTBEATS_KEY)

  const staleProcessIds: string[] = []
  const result: (ProcessHeartbeat & { id: string })[] = []

  for (const [ processId, value ] of Object.entries(hash)) {
    let heartbeat: ProcessHeartbeat

    try {
      heartbeat = JSON.parse(value)
    } catch (err) {
      logger.warn(`Cannot parse the heartbeat of process ${processId}.`, { err })
    }

    if (typeof heartbeat?.lastSeenAt !== 'number' || Date.now() - heartbeat.lastSeenAt > staleAfterMs) {
      staleProcessIds.push(processId)
      continue
    }

    result.push({ id: processId, ...heartbeat })
  }

  if (staleProcessIds.length !== 0) await deleteHashFields(HEARTBEATS_KEY, staleProcessIds)

  return result
}
