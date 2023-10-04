import Bluebird from 'bluebird'
import { URL } from 'url'
import { ActivityPubOrderedCollection } from '@peertube/peertube-models'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { logger } from '../../helpers/logger.js'
import { ACTIVITY_PUB, WEBSERVER } from '../../initializers/constants.js'
import { fetchAP } from './activity.js'

type HandlerFunction<T> = (items: T[]) => (Promise<any> | Bluebird<any>)
type CleanerFunction = (startedDate: Date) => Promise<any>

async function crawlCollectionPage <T> (argUrl: string, handler: HandlerFunction<T>, cleaner?: CleanerFunction) {
  let url = argUrl

  logger.info('Crawling ActivityPub data on %s.', url)

  const startDate = new Date()

  const response = await fetchAP<ActivityPubOrderedCollection<T>>(url)
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

      const res = await fetchAP<ActivityPubOrderedCollection<T>>(url)
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
