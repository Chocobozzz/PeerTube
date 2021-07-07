import { queue, QueueObject } from 'async'
import { logger } from '@server/helpers/logger'
import { SCHEDULER_INTERVALS_MS } from '@server/initializers/constants'
import { MActorDefault, MActorSignature } from '@server/types/models'
import { Activity } from '@shared/models'
import { StatsManager } from '../stat-manager'
import { processActivities } from './process'

type QueueParam = {
  activities: Activity[]
  signatureActor?: MActorSignature
  inboxActor?: MActorDefault
}

class InboxManager {

  private static instance: InboxManager

  private readonly inboxQueue: QueueObject<QueueParam>

  private constructor () {
    this.inboxQueue = queue<QueueParam, Error>((task, cb) => {
      const options = { signatureActor: task.signatureActor, inboxActor: task.inboxActor }

      processActivities(task.activities, options)
        .then(() => cb())
        .catch(err => {
          logger.error('Error in process activities.', { err })
          cb()
        })
    })

    setInterval(() => {
      StatsManager.Instance.updateInboxWaiting(this.getActivityPubMessagesWaiting())
    }, SCHEDULER_INTERVALS_MS.updateInboxStats)
  }

  addInboxMessage (options: QueueParam) {
    this.inboxQueue.push(options)
      .catch(err => logger.error('Cannot add options in inbox queue.', { options, err }))
  }

  getActivityPubMessagesWaiting () {
    return this.inboxQueue.length() + this.inboxQueue.running()
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  InboxManager
}
