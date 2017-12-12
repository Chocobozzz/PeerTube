import { Transaction } from 'sequelize'
import { AccountModel } from '../../models/account/account'
import { activitypubHttpJobScheduler, ActivityPubHttpPayload } from '../jobs/activitypub-http-job-scheduler'

async function addFetchOutboxJob (account: AccountModel, t: Transaction) {
  const jobPayload: ActivityPubHttpPayload = {
    uris: [ account.outboxUrl ]
  }

  return activitypubHttpJobScheduler.createJob(t, 'activitypubHttpFetcherHandler', jobPayload)
}

export {
  addFetchOutboxJob
}
