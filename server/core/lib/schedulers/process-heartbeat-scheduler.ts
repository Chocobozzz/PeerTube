import { DebugProcess } from '@peertube/peertube-models'
import { hostname } from 'node:os'
import { PEERTUBE_VERSION, SCHEDULER_INTERVALS_MS } from '../../initializers/constants.js'
import { getProcessRole } from '../../initializers/process-role.js'
import { currentProcessId, Redis } from '../redis/index.js'
import { AbstractScheduler } from './abstract-scheduler.js'

/**
 * Every process of the platform publishes a heartbeat in Redis, so the primary knows which processes are up
 */
export class ProcessHeartbeatScheduler extends AbstractScheduler {
  private static instance: ProcessHeartbeatScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.PROCESS_HEARTBEAT

  private startedAt: number
  private heartbeat: Promise<any>
  private stopped = false

  private constructor () {
    super({ randomRunOnEnable: false })
  }

  async register () {
    this.startedAt = Date.now()

    await this.execute()

    if (!this.stopped) this.enable()
  }

  async unregister () {
    if (!this.startedAt) return

    this.stopped = true
    this.disable()

    await this.heartbeat

    await Redis.Instance.removeProcessHeartbeat(currentProcessId)
  }

  async listUpProcesses (): Promise<DebugProcess[]> {
    const heartbeats = await Redis.Instance.getProcessHeartbeats(SCHEDULER_INTERVALS_MS.PROCESS_HEARTBEAT * 3)

    return heartbeats
      .sort((a, b) => {
        if (a.role !== b.role) {
          return a.role === 'primary'
            ? -1
            : 1
        }

        return a.startedAt - b.startedAt
      })
      .map(h => ({
        id: h.id,
        role: h.role,
        hostname: h.hostname,
        pid: h.pid,
        version: h.version,
        startedAt: new Date(h.startedAt).toISOString(),
        lastSeenAt: new Date(h.lastSeenAt).toISOString()
      }))
  }

  protected async internalExecute () {
    if (this.stopped) return

    this.heartbeat = Redis.Instance.setProcessHeartbeat(currentProcessId, {
      role: getProcessRole(),
      hostname: hostname(),
      pid: process.pid,
      version: PEERTUBE_VERSION,
      startedAt: this.startedAt,
      lastSeenAt: Date.now()
    })

    try {
      await this.heartbeat
    } finally {
      this.heartbeat = undefined
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
