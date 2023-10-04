import { logger } from '@server/helpers/logger.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { getServerActor } from '@server/models/application/application.js'
import { JobQueue } from '../job-queue/index.js'

async function addFetchOutboxJob (actor: Pick<ActorModel, 'id' | 'outboxUrl'>) {
  // Don't fetch ourselves
  const serverActor = await getServerActor()
  if (serverActor.id === actor.id) {
    logger.error('Cannot fetch our own outbox!')
    return undefined
  }

  const payload = {
    uri: actor.outboxUrl,
    type: 'activity' as 'activity'
  }

  return JobQueue.Instance.createJobAsync({ type: 'activitypub-http-fetcher', payload })
}

export {
  addFetchOutboxJob
}
