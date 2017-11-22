import { Transaction } from 'sequelize'
import { AccountInstance } from '../../models/account/account-interface'
import { activitypubHttpJobScheduler, ActivityPubHttpPayload } from '../jobs/activitypub-http-job-scheduler/activitypub-http-job-scheduler'

async function addFetchOutboxJob (account: AccountInstance, t: Transaction) {
  const jobPayload: ActivityPubHttpPayload = {
    uris: [ account.outboxUrl ]
  }

  return activitypubHttpJobScheduler.createJob(t, 'activitypubHttpFetcherHandler', jobPayload)
}

export {
  addFetchOutboxJob
}
