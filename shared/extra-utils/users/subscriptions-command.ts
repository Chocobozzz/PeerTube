import { ResultList, Video, VideoChannel } from '@shared/models'
import { HttpStatusCode } from '../../core-utils/miscs/http-error-codes'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

export class SubscriptionsCommand extends AbstractCommand {

  add (options: OverrideCommandOptions & {
    targetUri: string
  }) {
    const path = '/api/v1/users/me/subscriptions'

    return this.postBodyRequest({
      ...options,

      path,
      fields: { uri: options.targetUri },
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
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  listVideos (options: OverrideCommandOptions & {
    sort?: string // default -createdAt
  } = {}) {
    const { sort = '-createdAt' } = options
    const path = '/api/v1/users/me/subscriptions/videos'

    return this.getRequestBody<ResultList<Video>>({
      ...options,

      path,
      query: { sort },
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
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }
}
