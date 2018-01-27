import { ActorModel } from '../../models/activitypub/actor'
import { JobQueue } from '../job-queue'

async function addFetchOutboxJob (actor: ActorModel) {
  const payload = {
    uris: [ actor.outboxUrl ]
  }

  return JobQueue.Instance.createJob({ type: 'activitypub-http-fetcher', payload })
}

export {
  addFetchOutboxJob
}
