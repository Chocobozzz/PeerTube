import { ACTIVITY_PUB, JOB_REQUEST_TIMEOUT, WEBSERVER } from '../../initializers/constants'
import { doRequest } from '../../helpers/requests'
import { logger } from '../../helpers/logger'
import * as Bluebird from 'bluebird'
import { ActivityPubOrderedCollection } from '../../../shared/models/activitypub'
import { parse } from 'url'

type HandlerFunction<T> = (items: T[]) => (Promise<any> | Bluebird<any>)
type CleanerFunction = (startedDate: Date) => (Promise<any> | Bluebird<any>)

async function crawlCollectionPage <T> (uri: string, handler: HandlerFunction<T>, cleaner?: CleanerFunction) {
  logger.info('Crawling ActivityPub data on %s.', uri)

  const options = {
    method: 'GET',
    uri,
    json: true,
    activityPub: true,
    timeout: JOB_REQUEST_TIMEOUT
  }

  const startDate = new Date()

  const response = await doRequest<ActivityPubOrderedCollection<T>>(options)
  const firstBody = response.body

  let limit = ACTIVITY_PUB.FETCH_PAGE_LIMIT
  let i = 0
  let nextLink = firstBody.first
  while (nextLink && i < limit) {
    // Don't crawl ourselves
    const remoteHost = parse(nextLink).host
    if (remoteHost === WEBSERVER.HOST) continue

    options.uri = nextLink

    const { body } = await doRequest<ActivityPubOrderedCollection<T>>(options)
    nextLink = body.next
    i++

    if (Array.isArray(body.orderedItems)) {
      const items = body.orderedItems
      logger.info('Processing %i ActivityPub items for %s.', items.length, options.uri)

      await handler(items)
    }
  }

  if (cleaner) await cleaner(startDate)
}

export {
  crawlCollectionPage
}
