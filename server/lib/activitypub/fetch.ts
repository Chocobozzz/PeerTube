import { Transaction } from 'sequelize'
import { ActorModel } from '../../models/activitypub/actor'
import { activitypubHttpJobScheduler, ActivityPubHttpPayload } from '../jobs/activitypub-http-job-scheduler'

async function addFetchOutboxJob (actor: ActorModel, t: Transaction) {
  const jobPayload: ActivityPubHttpPayload = {
    uris: [ actor.outboxUrl ]
  }

  return activitypubHttpJobScheduler.createJob(t, 'activitypubHttpFetcherHandler', jobPayload)
}

export {
  addFetchOutboxJob
}
