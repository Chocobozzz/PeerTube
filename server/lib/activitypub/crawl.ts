import { ACTIVITY_PUB, JOB_REQUEST_TIMEOUT } from '../../initializers'
import { doRequest } from '../../helpers/requests'
import { logger } from '../../helpers/logger'

async function crawlCollectionPage <T> (uri: string, handler: (items: T[]) => Promise<any>) {
  logger.info('Crawling ActivityPub data on %s.', uri)

  const options = {
    method: 'GET',
    uri,
    json: true,
    activityPub: true,
    timeout: JOB_REQUEST_TIMEOUT
  }

  const response = await doRequest(options)
  const firstBody = response.body

  let limit = ACTIVITY_PUB.FETCH_PAGE_LIMIT
  let i = 0
  let nextLink = firstBody.first
  while (nextLink && i < limit) {
    options.uri = nextLink

    const { body } = await doRequest(options)
    nextLink = body.next
    i++

    if (Array.isArray(body.orderedItems)) {
      const items = body.orderedItems
      logger.info('Processing %i ActivityPub items for %s.', items.length, nextLink)

      await handler(items)
    }
  }
}

export {
  crawlCollectionPage
}
