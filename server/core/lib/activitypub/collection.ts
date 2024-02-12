import Bluebird from 'bluebird'
import validator from 'validator'
import { pageToStartAndCount } from '@server/helpers/core-utils.js'
import { ACTIVITY_PUB } from '@server/initializers/constants.js'
import { ResultList } from '@peertube/peertube-models'
import { forceNumber } from '@peertube/peertube-core-utils'

type ActivityPubCollectionPaginationHandler = (start: number, count: number) => Bluebird<ResultList<any>> | Promise<ResultList<any>>

export async function activityPubCollectionPagination (
  baseUrl: string,
  handler: ActivityPubCollectionPaginationHandler,
  page?: any,
  size = ACTIVITY_PUB.COLLECTION_ITEMS_PER_PAGE
) {
  if (!page || !validator.default.isInt(page)) {
    // We just display the first page URL, we only need the total items
    const result = await handler(0, 1)

    return {
      id: baseUrl,
      type: 'OrderedCollection',
      totalItems: result.total,
      first: result.data.length === 0
        ? undefined
        : baseUrl + '?page=1'
    }
  }

  const { start, count } = pageToStartAndCount(page, size)
  const result = await handler(start, count)

  let next: string | undefined
  let prev: string | undefined

  // Assert page is a number
  page = forceNumber(page)

  // There are more results
  if (result.total > page * size) {
    next = baseUrl + '?page=' + (page + 1)
  }

  if (page > 1) {
    prev = baseUrl + '?page=' + (page - 1)
  }

  return {
    id: baseUrl + '?page=' + page,
    type: 'OrderedCollectionPage',
    prev,
    next,
    partOf: baseUrl,
    orderedItems: result.data,
    totalItems: result.total
  }
}

export function activityPubCollection <T> (baseUrl: string, items: T[]) {
  return {
    id: baseUrl,
    type: 'OrderedCollection' as 'OrderedCollection',
    totalItems: items.length,
    orderedItems: items
  }
}
