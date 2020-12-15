import { AsyncQueue, queue } from 'async'
import { logger } from '@server/helpers/logger'
import { SCHEDULER_INTERVALS_MS } from '@server/initializers/constants'
import { MActorDefault, MActorSignature } from '@server/types/models'
import { Activity } from '@shared/models'
import { processActivities } from './process'
import { StatsManager } from '../stat-manager'

type QueueParam = {
  activities: Activity[]
  signatureActor?: MActorSignature
  inboxActor?: MActorDefault
}

class InboxManager {

  private static instance: InboxManager

  private readonly inboxQueue: AsyncQueue<QueueParam>

  private messagesProcessed = 0

  private constructor () {
    this.inboxQueue = queue<QueueParam, Error>((task, cb) => {
      const options = { signatureActor: task.signatureActor, inboxActor: task.inboxActor }

      this.messagesProcessed++

      processActivities(task.activities, options)
        .then(() => cb())
        .catch(err => {
          logger.error('Error in process activities.', { err })
          cb()
        })
    })

    setInterval(() => {
      StatsManager.Instance.updateInboxStats(this.messagesProcessed, this.inboxQueue.length())
    }, SCHEDULER_INTERVALS_MS.updateInboxStats)
  }

  addInboxMessage (options: QueueParam) {
    this.inboxQueue.push(options)
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  InboxManager
}
