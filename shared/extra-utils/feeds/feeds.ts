
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

type FeedType = 'videos' | 'video-comments' | 'subscriptions'

export class FeedCommand extends AbstractCommand {

  getXML (options: OverrideCommandOptions & {
    feed: FeedType
    format?: string
  }) {
    const { feed, format } = options
    const path = '/feeds/' + feed + '.xml'

    return this.getRequestText({
      ...options,

      path,
      query: format ? { format } : undefined,
      accept: 'application/xml',
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  getJSON (options: OverrideCommandOptions & {
    feed: FeedType
    query?: { [ id: string ]: any }
  }) {
    const { feed, query } = options
    const path = '/feeds/' + feed + '.json'

    return this.getRequestText({
      ...options,

      path,
      query,
      accept: 'application/json',
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }
}
