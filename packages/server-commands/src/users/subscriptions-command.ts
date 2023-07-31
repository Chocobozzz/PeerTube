import { HttpStatusCode, ResultList, VideoChannel } from '@peertube/peertube-models'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class SubscriptionsCommand extends AbstractCommand {

  add (options: OverrideCommandOptions & {
    targetUri: string
  }) {
    const path = '/api/v1/users/me/subscriptions'

    return this.postBodyRequest({
      ...options,

      path,
      fields: { uri: options.targetUri },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  list (options: OverrideCommandOptions & {
    sort?: string // default -createdAt
    search?: string
  } = {}) {
    const { sort = '-createdAt', search } = options
    const path = '/api/v1/users/me/subscriptions'

    return this.getRequestBody<ResultList<VideoChannel>>({
      ...options,

      path,
      query: {
        sort,
        search
      },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  get (options: OverrideCommandOptions & {
    uri: string
  }) {
    const path = '/api/v1/users/me/subscriptions/' + options.uri

    return this.getRequestBody<VideoChannel>({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  remove (options: OverrideCommandOptions & {
    uri: string
  }) {
    const path = '/api/v1/users/me/subscriptions/' + options.uri

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  exist (options: OverrideCommandOptions & {
    uris: string[]
  }) {
    const path = '/api/v1/users/me/subscriptions/exist'

    return this.getRequestBody<{ [id: string ]: boolean }>({
      ...options,

      path,
      query: { 'uris[]': options.uris },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }
}
