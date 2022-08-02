import PQueue from 'p-queue'
import { logger } from '@server/helpers/logger'
import { SCHEDULER_INTERVALS_MS } from '@server/initializers/constants'
import { MActorDefault, MActorSignature } from '@server/types/models'
import { Activity } from '@shared/models'
import { StatsManager } from '../stat-manager'
import { processActivities } from './process'

class InboxManager {

  private static instance: InboxManager
  private readonly inboxQueue: PQueue

  private constructor () {
    this.inboxQueue = new PQueue({ concurrency: 1 })

    setInterval(() => {
      StatsManager.Instance.updateInboxWaiting(this.getActivityPubMessagesWaiting())
    }, SCHEDULER_INTERVALS_MS.UPDATE_INBOX_STATS)
  }

  addInboxMessage (param: {
    activities: Activity[]
    signatureActor?: MActorSignature
    inboxActor?: MActorDefault
  }) {
    this.inboxQueue.add(() => {
      const options = { signatureActor: param.signatureActor, inboxActor: param.inboxActor }

      return processActivities(param.activities, options)
    }).catch(err => logger.error('Error with inbox queue.', { err }))
  }

  getActivityPubMessagesWaiting () {
    return this.inboxQueue.size + this.inboxQueue.pending
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  InboxManager
}
