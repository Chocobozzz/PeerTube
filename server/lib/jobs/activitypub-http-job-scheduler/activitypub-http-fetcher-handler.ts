import { logger } from '../../../helpers/logger'
import { doRequest } from '../../../helpers/requests'
import { ACTIVITY_PUB } from '../../../initializers'
import { processActivities } from '../../activitypub/process'
import { ActivityPubHttpPayload } from './activitypub-http-job-scheduler'

async function process (payload: ActivityPubHttpPayload, jobId: number) {
  logger.info('Processing ActivityPub fetcher in job %d.', jobId)

  const options = {
    method: 'GET',
    uri: '',
    json: true,
    activityPub: true
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

function onError (err: Error, jobId: number) {
  logger.error('Error when fetcher ActivityPub request in job %d.', jobId, err)
  return Promise.resolve()
}

function onSuccess (jobId: number) {
  logger.info('Job %d is a success.', jobId)
  return Promise.resolve()
}

// ---------------------------------------------------------------------------

export {
  process,
  onError,
  onSuccess
}
