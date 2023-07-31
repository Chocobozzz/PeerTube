import { HttpStatusCode, ResultList, VideoChangeOwnership } from '@peertube/peertube-models'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class ChangeOwnershipCommand extends AbstractCommand {

  create (options: OverrideCommandOptions & {
    videoId: number | string
    username: string
  }) {
    const { videoId, username } = options
    const path = '/api/v1/videos/' + videoId + '/give-ownership'

    return this.postBodyRequest({
      ...options,

      path,
      fields: { username },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  list (options: OverrideCommandOptions = {}) {
    const path = '/api/v1/videos/ownership'

    return this.getRequestBody<ResultList<VideoChangeOwnership>>({
      ...options,

      path,
      query: { sort: '-createdAt' },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  accept (options: OverrideCommandOptions & {
    ownershipId: number
    channelId: number
  }) {
    const { ownershipId, channelId } = options
    const path = '/api/v1/videos/ownership/' + ownershipId + '/accept'

    return this.postBodyRequest({
      ...options,

      path,
      fields: { channelId },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  refuse (options: OverrideCommandOptions & {
    ownershipId: number
  }) {
    const { ownershipId } = options
    const path = '/api/v1/videos/ownership/' + ownershipId + '/refuse'

    return this.postBodyRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }
}
