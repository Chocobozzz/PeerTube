import PQueue from 'p-queue'
import { logger } from '@server/helpers/logger.js'
import { SCHEDULER_INTERVALS_MS } from '@server/initializers/constants.js'
import { MActorDefault, MActorSignature } from '@server/types/models/index.js'
import { Activity, ActivityType } from '@peertube/peertube-models'
import { StatsManager } from '../stat-manager.js'
import { processActivities } from './process/index.js'

export class InboxManager {
  private static instance: InboxManager
  private readonly seqInboxQueue: PQueue
  private readonly parallelInboxQueue: PQueue

  private readonly parallelActivities = new Set<ActivityType>([ 'View', 'Download' ])

  private constructor () {
    this.seqInboxQueue = new PQueue({ concurrency: 1 })
    this.parallelInboxQueue = new PQueue({ concurrency: 10 })

    setInterval(() => {
      StatsManager.Instance.updateInboxWaiting(this.getActivityPubMessagesWaiting())
    }, SCHEDULER_INTERVALS_MS.UPDATE_INBOX_STATS)
  }

  addInboxMessage (param: {
    activities: Activity[]
    signatureActor?: MActorSignature
    inboxActor?: MActorDefault
  }) {
    const queue = param.activities.every(activity => this.parallelActivities.has(activity.type))
      ? this.parallelInboxQueue
      : this.seqInboxQueue

    queue.add(() => {
      const options = { signatureActor: param.signatureActor, inboxActor: param.inboxActor }

      return processActivities(param.activities, options)
    }).catch(err => logger.error('Error with inbox queue.', { err }))
  }

  getActivityPubMessagesWaiting () {
    return this.seqInboxQueue.size +
      this.seqInboxQueue.pending +
      this.parallelInboxQueue.size +
      this.parallelInboxQueue.pending
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
