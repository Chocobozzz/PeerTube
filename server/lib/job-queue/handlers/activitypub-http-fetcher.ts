import * as kue from 'kue'
import { logger } from '../../../helpers/logger'
import { processActivities } from '../../activitypub/process'
import { ActivitypubHttpBroadcastPayload } from './activitypub-http-broadcast'
import { crawlCollectionPage } from '../../activitypub/crawl'
import { Activity } from '../../../../shared/models/activitypub'

export type ActivitypubHttpFetcherPayload = {
  uris: string[]
}

async function processActivityPubHttpFetcher (job: kue.Job) {
  logger.info('Processing ActivityPub fetcher in job %d.', job.id)

  const payload = job.data as ActivitypubHttpBroadcastPayload

  for (const uri of payload.uris) {
    await crawlCollectionPage<Activity>(uri, (items) => processActivities(items))
  }
}

// ---------------------------------------------------------------------------

export {
  processActivityPubHttpFetcher
}
