
import { HttpStatusCode, ResultList, VideoBlacklist, VideoBlacklistType } from '@shared/models'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

export class BlacklistCommand extends AbstractCommand {

  add (options: OverrideCommandOptions & {
    videoId: number | string
    reason?: string
    unfederate?: boolean
  }) {
    const { videoId, reason, unfederate } = options
    const path = '/api/v1/videos/' + videoId + '/blacklist'

    return this.postBodyRequest({
      ...options,

      path,
      fields: { reason, unfederate },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  update (options: OverrideCommandOptions & {
    videoId: number | string
    reason?: string
  }) {
    const { videoId, reason } = options
    const path = '/api/v1/videos/' + videoId + '/blacklist'

    return this.putBodyRequest({
      ...options,

      path,
      fields: { reason },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  remove (options: OverrideCommandOptions & {
    videoId: number | string
  }) {
    const { videoId } = options
    const path = '/api/v1/videos/' + videoId + '/blacklist'

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  list (options: OverrideCommandOptions & {
    sort?: string
    type?: VideoBlacklistType
  } = {}) {
    const { sort, type } = options
    const path = '/api/v1/videos/blacklist/'

    const query = { sort, type }

    return this.getRequestBody<ResultList<VideoBlacklist>>({
      ...options,

      path,
      query,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }
}
