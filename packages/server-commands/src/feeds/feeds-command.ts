import { buildUUID } from '@peertube/peertube-node-utils'
import { HttpStatusCode } from '@peertube/peertube-models'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

type FeedType = 'videos' | 'video-comments' | 'subscriptions'

export class FeedCommand extends AbstractCommand {
  getXML (
    options: OverrideCommandOptions & {
      feed: FeedType
      ignoreCache: boolean
      format?: string
      query?: { [id: string]: any }
    }
  ) {
    const { feed, format, ignoreCache, query = {} } = options
    const path = '/feeds/' + feed + '.xml'

    const internalQuery: { [id: string]: string } = {}

    if (ignoreCache) internalQuery.v = buildUUID()
    if (format) internalQuery.format = format

    return this.getRequestText({
      ...options,

      path,
      query: { ...internalQuery, ...query },
      accept: 'application/xml',
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  getPodcastXML (
    options: OverrideCommandOptions & {
      ignoreCache: boolean
      channelId: number
    }
  ) {
    const { ignoreCache, channelId } = options
    const path = `/feeds/podcast/videos.xml`

    const query: { [id: string]: string } = {}

    if (ignoreCache) query.v = buildUUID()
    if (channelId) query.videoChannelId = channelId + ''

    return this.getRequestText({
      ...options,

      path,
      query,
      accept: 'application/xml',
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  getJSON (
    options: OverrideCommandOptions & {
      feed: FeedType
      ignoreCache: boolean
      query?: { [id: string]: any }
    }
  ) {
    const { feed, query = {}, ignoreCache } = options
    const path = '/feeds/' + feed + '.json'

    const cacheQuery = ignoreCache
      ? { v: buildUUID() }
      : {}

    return this.getRequestText({
      ...options,

      path,
      query: { ...query, ...cacheQuery },
      accept: 'application/json',
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }
}
