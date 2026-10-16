import { AsyncLocalStorage } from 'node:async_hooks'
import type { ReadReplica } from './shared/read-replica-monitor.js'

export type DbContext = {
  // So user writes stay visible in next reads
  userId?: number

  // SELECT queries made outside a transaction may be sent to a read replica
  allowReplica: boolean

  // Shared by the contexts of a request: background tasks must not use the request context when it's eneded
  request?: { ended: boolean }

  // Loaded lazily
  usePrimary?: Promise<boolean>

  // Replica used by the reads of the context, so successive reads keep the same replica
  replica?: ReadReplica | null

  // Last record of a write of the user, fetched from Redis
  lastUserWriteRecord?: { at: number, promise: Promise<void> }
}

const dbContextStore = new AsyncLocalStorage<DbContext>()

export function runInDbContext<T> (context: DbContext, fn: () => T): T {
  return dbContextStore.run(context, fn)
}

export function getDbContext () {
  const context = dbContextStore.getStore()
  if (context?.request?.ended === true) return undefined

  return context
}

export function runInDbContextOfUser<T> (userId: number, fn: () => T): T {
  const context = getDbContext()
  if (!context) return runInDbContext({ userId, allowReplica: false }, fn)

  context.userId = userId

  return fn()
}

export function runWithReplicaReads<T> (userId: number | undefined, fn: () => T): T {
  // Keep the writes of the request made before
  return runInDbContext({ ...getDbContext(), userId, allowReplica: true, replica: undefined }, fn)
}

// For background tasks started by a request, exit the current database context
export function runOutsideDbContext<T> (fn: () => T): T {
  return dbContextStore.exit(fn)
}
