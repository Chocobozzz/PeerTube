import { Activity, ActivityType } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { INBOX_CONCURRENCY, INBOX_WAITING_SYNC_THROTTLE_MS, SCHEDULER_INTERVALS_MS } from '@server/initializers/constants.js'
import { MActorDefault, MActorSignature } from '@server/types/models/index.js'
import PQueue from 'p-queue'
import { currentProcessId, Redis } from '../redis/index.js'
import { processActivities } from './process/index.js'

const logger = createLogger('ap')

export class InboxManager {
  private static instance: InboxManager
  // Activities about the same object can be processed at the same time, by this process or another one
  private readonly inboxQueue: PQueue
  private readonly viewsAndDownloadsInboxQueue: PQueue

  private readonly viewsAndDownloadsActivities = new Set<ActivityType>([ 'View', 'Download' ])

  // Throttled Redis updates of our waiting messages count, only one at a time
  private waitingSync: Promise<unknown>
  private waitingSyncTimer: NodeJS.Timeout

  private readonly waitingSyncInterval: NodeJS.Timeout
  private stopped = false

  private constructor () {
    this.inboxQueue = new PQueue({ concurrency: INBOX_CONCURRENCY.OTHERS })
    this.viewsAndDownloadsInboxQueue = new PQueue({ concurrency: INBOX_CONCURRENCY.VIEWS_AND_DOWNLOADS })

    for (const queue of this.getQueues()) {
      queue.on('add', () => this.requestMessagesWaitingStatsSync())
      queue.on('next', () => this.requestMessagesWaitingStatsSync())
    }

    // Other processes ignore our count if we don't refresh it
    this.waitingSyncInterval = setInterval(() => this.syncMessagesWaitingStats(), SCHEDULER_INTERVALS_MS.UPDATE_INBOX_STATS)
  }

  addInboxMessage (param: {
    activities: Activity[]
    signatureActor?: MActorSignature
    inboxActor?: MActorDefault
  }) {
    const queue = param.activities.every(activity => this.viewsAndDownloadsActivities.has(activity.type))
      ? this.viewsAndDownloadsInboxQueue
      : this.inboxQueue

    queue.add(() => {
      const options = { signatureActor: param.signatureActor, inboxActor: param.inboxActor }

      return processActivities(param.activities, options)
    }).catch(err => logger.error('Error with inbox queue.', { err }))
  }

  static async drain (timeoutMs: number) {
    if (!this.instance) return

    await this.instance.drain(timeoutMs)
  }

  private async drain (timeoutMs: number) {
    const waiting = this.countMessagesWaiting()
    if (waiting !== 0) logger.info('Processing %d inbox messages before stopping.', waiting)

    let timeoutTimer: NodeJS.Timeout
    const timeout = new Promise<'timeout'>(res => {
      timeoutTimer = setTimeout(() => res('timeout'), timeoutMs)
    })

    const result = await Promise.race([
      Promise.all(this.getQueues().map(queue => queue.onIdle())),
      timeout
    ])
    clearTimeout(timeoutTimer)

    if (result === 'timeout') {
      logger.warn('Cannot process %d inbox messages in %dms before stopping, they are lost.', this.countMessagesWaiting(), timeoutMs)

      for (const queue of this.getQueues()) {
        queue.pause()
        queue.clear()
      }
    }

    this.stopped = true
    clearInterval(this.waitingSyncInterval)
    clearTimeout(this.waitingSyncTimer)

    try {
      await this.waitingSync
      await Redis.Instance.removeInboxWaiting(currentProcessId)
    } catch (err) {
      logger.error('Cannot remove the inbox messages waiting count.', { err })
    }
  }

  private countMessagesWaiting () {
    return this.getQueues().reduce((total, queue) => total + queue.size + queue.pending, 0)
  }

  private getQueues () {
    return [ this.inboxQueue, this.viewsAndDownloadsInboxQueue ]
  }

  private requestMessagesWaitingStatsSync () {
    if (this.stopped || this.waitingSyncTimer !== undefined) return

    this.waitingSyncTimer = setTimeout(() => {
      this.waitingSyncTimer = undefined
      this.syncMessagesWaitingStats()
    }, INBOX_WAITING_SYNC_THROTTLE_MS)
  }

  private syncMessagesWaitingStats () {
    if (this.stopped) return

    // Don't let an older count overwrite a newer one
    if (this.waitingSync !== undefined) return this.requestMessagesWaitingStatsSync()

    this.waitingSync = Redis.Instance.setInboxWaiting(currentProcessId, this.countMessagesWaiting())
      .catch(err => logger.error('Cannot update the inbox messages waiting count.', { err }))
      .finally(() => {
        this.waitingSync = undefined
      })
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
