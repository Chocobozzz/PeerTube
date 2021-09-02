import Bluebird from 'bluebird'
import { URL } from 'url'
import { retryTransactionWrapper } from '@server/helpers/database-utils'
import { ActivityPubOrderedCollection } from '../../../shared/models/activitypub'
import { logger } from '../../helpers/logger'
import { doJSONRequest } from '../../helpers/requests'
import { ACTIVITY_PUB, WEBSERVER } from '../../initializers/constants'

type HandlerFunction<T> = (items: T[]) => (Promise<any> | Bluebird<any>)
type CleanerFunction = (startedDate: Date) => Promise<any>

async function crawlCollectionPage <T> (argUrl: string, handler: HandlerFunction<T>, cleaner?: CleanerFunction) {
  let url = argUrl

  logger.info('Crawling ActivityPub data on %s.', url)

  const options = { activityPub: true }

  const startDate = new Date()

  const response = await doJSONRequest<ActivityPubOrderedCollection<T>>(url, options)
  const firstBody = response.body

  const limit = ACTIVITY_PUB.FETCH_PAGE_LIMIT
  let i = 0
  let nextLink = firstBody.first
  while (nextLink && i < limit) {
    let body: any

    if (typeof nextLink === 'string') {
      // Don't crawl ourselves
      const remoteHost = new URL(nextLink).host
      if (remoteHost === WEBSERVER.HOST) continue

      url = nextLink

      const res = await doJSONRequest<ActivityPubOrderedCollection<T>>(url, options)
      body = res.body
    } else {
      // nextLink is already the object we want
      body = nextLink
    }

    nextLink = body.next
    i++

    if (Array.isArray(body.orderedItems)) {
      const items = body.orderedItems
      logger.info('Processing %i ActivityPub items for %s.', items.length, url)

      await handler(items)
    }
  }

  if (cleaner) await retryTransactionWrapper(cleaner, startDate)
}

export {
  crawlCollectionPage
}
