import * as kue from 'kue'
import { logger } from '../../../helpers/logger'
import { doRequest } from '../../../helpers/requests'
import { ACTIVITY_PUB, JOB_REQUEST_TIMEOUT } from '../../../initializers'
import { processActivities } from '../../activitypub/process'
import { ActivitypubHttpBroadcastPayload } from './activitypub-http-broadcast'

export type ActivitypubHttpFetcherPayload = {
  uris: string[]
}

async function processActivityPubHttpFetcher (job: kue.Job) {
  logger.info('Processing ActivityPub fetcher in job %d.', job.id)

  const payload = job.data as ActivitypubHttpBroadcastPayload

  const options = {
    method: 'GET',
    uri: '',
    json: true,
    activityPub: true,
    timeout: JOB_REQUEST_TIMEOUT
  }

  for (const uri of payload.uris) {
    options.uri = uri
    logger.info('Fetching ActivityPub data on %s.', uri)

    const response = await doRequest(options)
    const firstBody = response.body

    if (firstBody.first && Array.isArray(firstBody.first.orderedItems)) {
      const activities = firstBody.first.orderedItems

      logger.info('Processing %i items ActivityPub fetcher for %s.', activities.length, options.uri)

      await processActivities(activities)
    }

    let limit = ACTIVITY_PUB.FETCH_PAGE_LIMIT
    let i = 0
    let nextLink = firstBody.first.next
    while (nextLink && i < limit) {
      options.uri = nextLink

      const { body } = await doRequest(options)
      nextLink = body.next
      i++

      if (Array.isArray(body.orderedItems)) {
        const activities = body.orderedItems
        logger.info('Processing %i items ActivityPub fetcher for %s.', activities.length, options.uri)

        await processActivities(activities)
      }
    }
  }
}

// ---------------------------------------------------------------------------

export {
  processActivityPubHttpFetcher
}
