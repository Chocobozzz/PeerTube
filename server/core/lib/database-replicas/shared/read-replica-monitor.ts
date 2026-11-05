import { isTestInstance } from '@peertube/peertube-node-utils'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { DATABASE_READ_REPLICAS } from '@server/initializers/constants.js'
import { QueryOptionsWithType, QueryTypes, Sequelize } from 'sequelize'
import { Pool } from 'sequelize-pool'
import { parsePgLsn } from './lsn.js'

/**
 * Monitor replica lag using their known WAL positions and determine their usability for read queries
 */

const logger = createLogger('database-replicas')

const ERROR_LOG_INTERVAL_MS = 60000

export type ReadReplica = {
  name: string

  pool: Pool<any>
  // Dedicated connection of the monitor, so it is not delayed by saturated pools of read queries
  monitorPool: Pool<any>

  lagMs: number
  healthy: boolean
  lastPollAt: number
  polling: boolean

  lastErrorLogAt: number
}

type PrimarySample = { at: number, lsn: bigint }

export class ReadReplicaMonitor {
  // Primary WAL positions over time (oldest first), to compute the lag of replicas
  private readonly primarySamples: PrimarySample[] = []
  private primaryPolling = false

  private timer: NodeJS.Timeout

  constructor (
    private readonly sequelize: Sequelize,
    private readonly replicas: ReadReplica[],
    private readonly primaryMonitorPool: Pool<any>
  ) {
  }

  start () {
    this.timer = setInterval(() => this.poll(), DATABASE_READ_REPLICAS.MONITOR_INTERVAL_MS)
    this.timer.unref()

    this.poll()
  }

  stop () {
    clearInterval(this.timer)
  }

  getReplicas () {
    return this.replicas
  }

  // Undefined if no replica can serve the read
  pickReplica () {
    const now = Date.now()

    const candidates = this.replicas.filter(r => this.isReplicaUsable(r, now))

    if (candidates.length === 0) return undefined

    return candidates[Math.floor(Math.random() * candidates.length)]
  }

  isReplicaUsable (replica: ReadReplica, now = Date.now()) {
    if (replica.healthy !== true) return false

    const pollAge = now - replica.lastPollAt

    // Don't use a replica whose poll is too old (hanging?)
    if (pollAge > DATABASE_READ_REPLICAS.MONITOR_INTERVAL_MS * 2) return false

    return replica.lagMs + pollAge <= CONFIG.DATABASE.READ_REPLICAS.MAX_LAG
  }

  disableReplica (replica: ReadReplica, err: Error) {
    if (!replica.healthy) return

    replica.healthy = false

    logger.warn(`Stop using database read replica ${replica.name} after a connection error.`, { err })
  }

  // ---------------------------------------------------------------------------

  private poll () {
    this.pollPrimary()
      .catch(err => logger.debug('Cannot get primary WAL position.', { err }))

    for (const replica of this.replicas) {
      this.pollReplica(replica)
        .catch(err => logger.error(`Cannot poll database read replica ${replica.name}.`, { err }))
    }
  }

  private async pollPrimary () {
    if (this.primaryPolling) return
    this.primaryPolling = true

    try {
      const now = Date.now()

      const options = {
        type: QueryTypes.SELECT,
        logging: false,
        peertubePool: this.primaryMonitorPool
      } as QueryOptionsWithType<QueryTypes.SELECT>

      // Not the insert position, that can stay ahead of what replicas can replay (page header, WAL not written yet...)
      const [ row ] = await this.sequelize.query<{ lsn: string }>(
        'SELECT pg_current_wal_lsn()::text AS "lsn"',
        options
      )

      this.primarySamples.push({ at: now, lsn: parsePgLsn(row.lsn) })

      // Keep enough history to detect replicas lagging more than the max lag
      const minDate = now - CONFIG.DATABASE.READ_REPLICAS.MAX_LAG

      while (this.primarySamples.length > 1 && this.primarySamples[0].at < minDate) {
        this.primarySamples.shift()
      }
    } finally {
      this.primaryPolling = false
    }
  }

  private async pollReplica (replica: ReadReplica) {
    if (replica.polling) return
    replica.polling = true

    const wasHealthy = replica.healthy

    try {
      const options = {
        type: QueryTypes.SELECT,
        logging: false,
        peertubePool: replica.monitorPool
      } as QueryOptionsWithType<QueryTypes.SELECT>

      const [ row ] = await this.sequelize.query<{ inRecovery: boolean, lsn: string }>(
        'SELECT pg_is_in_recovery() AS "inRecovery", pg_last_wal_replay_lsn()::text AS "lsn"',
        options
      )

      if (row.inRecovery !== true) {
        if (!isTestInstance()) {
          throw new Error(`Database read replica ${replica.name} is not a standby server`)
        }

        // A primary used as a replica (tests only) is always up to date
        replica.lagMs = 0
      } else {
        replica.lagMs = computeReplicaLagMs(this.primarySamples, parsePgLsn(row.lsn), Date.now())
      }

      replica.lastPollAt = Date.now()
      replica.healthy = replica.lagMs <= CONFIG.DATABASE.READ_REPLICAS.MAX_LAG

      if (wasHealthy && !replica.healthy) {
        logger.warn(`Stop using database read replica ${replica.name} lagging ${replica.lagMs}ms behind the primary.`)
      }
    } catch (err) {
      replica.healthy = false

      if (wasHealthy || Date.now() - replica.lastErrorLogAt > ERROR_LOG_INTERVAL_MS) {
        replica.lastErrorLogAt = Date.now()

        logger.warn(`Cannot use database read replica ${replica.name}.`, { err })
      } else {
        logger.debug(`Cannot poll database read replica ${replica.name}.`, { err })
      }
    } finally {
      replica.polling = false
    }

    if (!wasHealthy && replica.healthy) {
      logger.info(`Using database read replica ${replica.name}.`)
    }
  }
}

// ---------------------------------------------------------------------------

export function computeReplicaLagMs (primarySamples: PrimarySample[], replayLsn: bigint, now: number) {
  for (let i = primarySamples.length - 1; i >= 0; i--) {
    const sample = primarySamples[i]

    if (sample.lsn <= replayLsn) return now - sample.at
  }

  // Older than our history (or no history yet)
  return Infinity
}
