import { isMainThread } from 'node:worker_threads'
import { logger } from './logger.js'

export function assertIsInWorkerThread () {
  if (!isMainThread) return

  logger.error('Caller is not in worker thread', { stack: new Error().stack })
}
