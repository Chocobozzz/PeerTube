import { logger } from '../../helpers/logger'
import { getServerActor } from '../../helpers/utils'
import { ActorModel } from '../../models/activitypub/actor'
import { JobQueue } from '../job-queue'

async function addFetchOutboxJob (actor: ActorModel) {
  // Don't fetch ourselves
  const serverActor = await getServerActor()
  if (serverActor.id === actor.id) {
    logger.error('Cannot fetch our own outbox!')
    return undefined
  }

  const payload = {
    uris: [ actor.outboxUrl ]
  }

  return JobQueue.Instance.createJob({ type: 'activitypub-http-fetcher', payload })
}

export {
  addFetchOutboxJob
}
