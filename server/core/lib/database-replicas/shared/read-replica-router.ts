import { isTestInstance } from '@peertube/peertube-node-utils'
import { createLogger } from '@server/helpers/logger.js'
import { DATABASE_READ_REPLICAS } from '@server/initializers/constants.js'
import { QueryOptions, QueryTypes, Sequelize, Transaction } from 'sequelize'
import { Pool } from 'sequelize-pool'
import { DbContext, getDbContext } from '../db-context.js'
import { ReadReplica, ReadReplicaMonitor } from './read-replica-monitor.js'
import { recordContextWrite, shouldContextUsePrimary } from './user-recent-writes.js'

/**
 * Sequelize has a very simple replica routing mechanism. Re-implement it to support:
 *   - Replica lag monitoring (to not select replicas that are too far behind the primary)
 *   - Be opt-in instead of opt-out (primary is used by default, a context must be marked to use replicas)
 *   - Handle "read-you-writes" mechanism (ensure that reads after writes see the latest data, using the user ID to track recent writes)
 */

const logger = createLogger('database-replicas')

// See https://www.postgresql.org/docs/current/errcodes-appendix.html
const READ_ONLY_SQL_TRANSACTION_ERROR_CODE = '25006'
// Query on a hot standby cancelled because of a conflict with recovery
const RECOVERY_CONFLICT_ERROR_CODE = '40001'
// admin_shutdown, crash_shutdown, cannot_connect_now
const SERVER_UNAVAILABLE_ERROR_CODES = new Set([ '57P01', '57P02', '57P03' ])

const SELECT_QUERY_TYPE: string = QueryTypes.SELECT
const RAW_QUERY_TYPE: string = QueryTypes.RAW
const WRITE_QUERY_TYPES = new Set<string>([
  QueryTypes.INSERT,
  QueryTypes.UPDATE,
  QueryTypes.BULKUPDATE,
  QueryTypes.BULKDELETE,
  QueryTypes.DELETE,
  QueryTypes.UPSERT
])

// Raw queries that don't write
const READ_OR_CONTROL_SQL_REGEX = /^\s*(SELECT|SHOW|EXPLAIN|VALUES|SET|START|BEGIN|SAVEPOINT|RELEASE|ROLLBACK|COMMIT)\b/i
// Writes declared as SELECT queries (UPDATE ... RETURNING...)
const WRITE_SQL_REGEX = /^\s*(INSERT|UPDATE|DELETE|MERGE)\b/i

type PeerTubeQueryRoute = {
  // Set when the query runs on a replica
  replica?: ReadReplica
}

type RouterQueryOptions = QueryOptions & {
  // Run the query using this pool
  peertubePool?: Pool<Connection>

  // Shared with the connection manager, to know where the query ran
  peertubeQueryRoute?: PeerTubeQueryRoute

  // Set by Sequelize on COMMIT/ROLLBACK queries
  completesTransaction?: boolean
}

type Connection = {
  // The pool where the connection is acquired from
  peertubePool?: Pool<Connection>

  peertubeReadReplica?: ReadReplica

  // Primary connection acquired for queries that could have used a replica
  peertubeReplicaFallback?: boolean
}

// Sequelize internals we reimplement
type ConnectionManager = {
  config: {
    host: string
    port: number
    pool: { max: number, idle: number, evict: number }
    dialectOptions?: Record<string, any>
  }

  getConnection: (options?: RouterQueryOptions) => Promise<Connection>
  releaseConnection: (connection: Connection) => void
  destroyConnection: (connection: Connection) => Promise<void>

  _connect: (config: Record<string, any>) => Promise<Connection>
  _disconnect: (connection: Connection) => Promise<void>
  _validate: (connection: Connection) => boolean
}

/**
 * Send SELECT queries made outside a transaction to a read replica if:
 *  - enabled by the context
 *  - a replica is healthy
 *  - the user of context did not write recently
 *
 * Use the primary otherwise
 */
export function installReadReplicaRouter (options: {
  sequelize: Sequelize
  hosts: { hostname: string, port: number }[]
}) {
  const { sequelize, hosts } = options
  const connectionManager = (sequelize as any).connectionManager as ConnectionManager

  const replicas = hosts.map(host => buildReadReplica(connectionManager, host))

  const primaryMonitorPool = buildPool(connectionManager, {
    name: 'peertube-database-monitor',
    applicationName: 'peertube-database-monitor',
    max: 1
  })

  const monitor = new ReadReplicaMonitor(sequelize, replicas, primaryMonitorPool)

  // ---------------------------------------------------------------------------

  const originalGetConnection = connectionManager.getConnection.bind(connectionManager)
  const originalReleaseConnection = connectionManager.releaseConnection.bind(connectionManager)
  const originalDestroyConnection = connectionManager.destroyConnection.bind(connectionManager)

  const stats = { replicaQueries: 0, primaryFallbackQueries: 0 }

  connectionManager.getConnection = async (options: RouterQueryOptions = {}) => {
    // Force a pool from the query
    if (options.peertubePool) return options.peertubePool.acquire()

    const { eligibleContext, replica } = await selectReplica(options)

    if (replica) {
      try {
        const connection = await replica.pool.acquire()
        connection.peertubeReadReplica = replica

        if (options.peertubeQueryRoute) options.peertubeQueryRoute.replica = replica

        return connection
      } catch (err) {
        logger.debug(`Cannot get a connection of database read replica ${replica.name}, fallback to primary.`, { err })

        // Next reads of the context must use the primary
        eligibleContext.replica = null
      }
    }

    const connection = await originalGetConnection(options)
    if (eligibleContext) connection.peertubeReplicaFallback = true

    return connection
  }

  connectionManager.releaseConnection = (connection: Connection) => {
    if (connection.peertubePool) return connection.peertubePool.release(connection)

    delete connection.peertubeReplicaFallback
    return originalReleaseConnection(connection)
  }

  connectionManager.destroyConnection = (connection: Connection) => {
    if (connection.peertubePool) return connection.peertubePool.destroy(connection)

    delete connection.peertubeReplicaFallback
    return originalDestroyConnection(connection)
  }

  async function selectReplica (options: RouterQueryOptions): Promise<{ eligibleContext?: DbContext, replica?: ReadReplica }> {
    if (options.type !== SELECT_QUERY_TYPE || options.useMaster === true) return {}

    const context = getDbContext()
    if (context?.allowReplica !== true) return {}

    if (await shouldContextUsePrimary(context)) return { eligibleContext: context }

    if (context.replica === undefined) context.replica = monitor.pickReplica() ?? null
    if (context.replica && !monitor.isReplicaUsable(context.replica)) context.replica = null

    return { eligibleContext: context, replica: context.replica ?? undefined }
  }

  // ---------------------------------------------------------------------------

  /**
   * Replay on the primary queries that failed on a replica because:
   *  - they are writes declared as SELECT (plugins, raw queries...)
   *  - the replica cancelled them because of a conflict with the replication
   *  - the replica connection broke (restart, failover, network...)
   *
   * Queries outside a transaction don't have side effects on a replica, so they can be replayed
   */

  const queryable = sequelize as unknown as { query: (sql: any, options?: RouterQueryOptions) => Promise<any> }
  const originalQuery = queryable.query.bind(sequelize)

  queryable.query = async (sql: any, options?: RouterQueryOptions) => {
    if (options?.transaction || options?.useMaster || options?.peertubePool) return originalQuery(sql, options)

    const route: PeerTubeQueryRoute = {}

    try {
      return await originalQuery(sql, { ...options, peertubeQueryRoute: route })
    } catch (err) {
      const replica = route.replica
      if (!replica) throw err

      const code = err?.original?.code
      const primaryOptions = { ...options, useMaster: true }

      if (code === READ_ONLY_SQL_TRANSACTION_ERROR_CODE) {
        logger.warn('Write query declared as a read sent to a database read replica, run it on the primary.', { sql, err })
        usePrimaryForNextReads()

        const result = await originalQuery(sql, primaryOptions)
        await recordContextWrite()

        return result
      }

      if (code === RECOVERY_CONFLICT_ERROR_CODE) {
        logger.info('Query cancelled by a database read replica, run it on the primary.', { err })
        usePrimaryForNextReads()

        return originalQuery(sql, primaryOptions)
      }

      if (isConnectionError(err)) {
        monitor.disableReplica(replica, err)
        usePrimaryForNextReads()

        return originalQuery(sql, primaryOptions)
      }

      throw err
    }
  }

  function usePrimaryForNextReads () {
    const context = getDbContext()
    if (context) context.replica = null
  }

  // ---------------------------------------------------------------------------

  // Transactions that wrote, so their commit is recorded as a write
  const writeTransactions = new WeakSet<Transaction>()

  sequelize.addHook('afterQuery', async (options: RouterQueryOptions, query) => {
    const { sql, connection } = query as unknown as { sql: string, connection: Connection }

    countEligibleQuery(options, connection)

    if (!getDbContext()) return

    if (options.transaction) {
      const transaction = getRootTransaction(options.transaction)

      if (isWriteStatement(options, sql)) {
        writeTransactions.add(transaction)
        return
      }

      const isCommit = options.completesTransaction === true && typeof sql === 'string' && sql.startsWith('COMMIT')
      if (!isCommit || !writeTransactions.has(transaction)) return
    } else if (!isWriteStatement(options, sql)) {
      return
    }

    await recordContextWrite()
  })

  function countEligibleQuery (options: RouterQueryOptions, connection: Connection) {
    // Monitor queries or non-write queries
    if (options.type !== SELECT_QUERY_TYPE || options.peertubePool) return

    if (connection?.peertubeReadReplica) stats.replicaQueries++
    else if (connection?.peertubeReplicaFallback) stats.primaryFallbackQueries++
  }

  monitor.start()

  logger.info(`Database read replicas enabled: ${replicas.map(r => r.name).join(', ')}.`)

  return {
    monitor,
    stats,

    close: async () => {
      monitor.stop()

      const pools = [ primaryMonitorPool, ...replicas.flatMap(r => [ r.pool, r.monitorPool ]) ]

      await Promise.all(pools.map(async pool => {
        await pool.drain()
        await pool.destroyAllNow()
      }))
    }
  }
}

// ---------------------------------------------------------------------------

function isWriteStatement (options: RouterQueryOptions, sql: string) {
  if (typeof sql !== 'string') return false

  if (options.type === RAW_QUERY_TYPE) return !READ_OR_CONTROL_SQL_REGEX.test(sql)
  if (options.type === SELECT_QUERY_TYPE) return WRITE_SQL_REGEX.test(sql)

  return WRITE_QUERY_TYPES.has(options.type)
}

function getRootTransaction (transaction: Transaction) {
  let root = transaction as Transaction & { parent?: Transaction }

  while (root.parent) root = root.parent

  return root
}

function isConnectionError (err: any) {
  const original = err?.original
  if (!original) return false

  const code = original.code
  if (typeof code === 'string') {
    // Connection exception class, or the server cannot run queries anymore
    if (code.startsWith('08') || SERVER_UNAVAILABLE_ERROR_CODES.has(code)) return true

    // Node.js network errors (ECONNRESET, EPIPE...)
    return /^E[A-Z]+$/.test(code)
  }

  return /^Connection terminated|Query read timeout|not queryable/.test(original.message ?? '')
}

function buildReadReplica (
  connectionManager: ConnectionManager,
  host: {
    hostname: string
    port: number
  }
): ReadReplica {
  const name = `${host.hostname}:${host.port}`

  return {
    name,

    pool: buildPool(connectionManager, {
      name: 'peertube-read-replica-' + name,
      host,
      applicationName: 'peertube-read-replica',
      max: connectionManager.config.pool.max,
      readOnly: isTestInstance()
    }),

    monitorPool: buildPool(connectionManager, {
      name: 'peertube-read-replica-monitor-' + name,
      host,
      applicationName: 'peertube-read-replica-monitor',
      max: 1
    }),

    lagMs: Infinity,
    healthy: false,
    lastPollAt: 0,
    polling: false,
    lastErrorLogAt: 0
  }
}

function buildPool (connectionManager: ConnectionManager, options: {
  name: string

  // The primary if not set
  host?: { hostname: string, port: number }

  applicationName: string

  max: number
  readOnly?: boolean
}) {
  const { name, host, applicationName, max, readOnly = false } = options
  const config = connectionManager.config

  const pool: Pool<Connection> = new Pool<Connection>({
    name,

    create: async () => {
      const connection = await connectionManager._connect({
        ...config,

        host: host?.hostname ?? config.host,
        port: host?.port ?? config.port,
        dialectOptions: {
          ...config.dialectOptions,

          application_name: applicationName,
          connectionTimeoutMillis: DATABASE_READ_REPLICAS.ACQUIRE_TIMEOUT_MS,

          ...(readOnly ? { options: '-c default_transaction_read_only=on' } : {})
        }
      })

      connection.peertubePool = pool

      return connection
    },
    destroy: connection => connectionManager._disconnect(connection),
    validate: connection => connectionManager._validate(connection),

    max,
    min: 0,
    acquireTimeoutMillis: DATABASE_READ_REPLICAS.ACQUIRE_TIMEOUT_MS,
    idleTimeoutMillis: config.pool.idle,
    reapIntervalMillis: config.pool.evict
  })

  return pool
}
