import { HttpStatusCode, ResultList, Video } from '@peertube/peertube-models'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class HistoryCommand extends AbstractCommand {

  list (options: OverrideCommandOptions & {
    search?: string
  } = {}) {
    const { search } = options
    const path = '/api/v1/users/me/history/videos'

    return this.getRequestBody<ResultList<Video>>({
      ...options,

      path,
      query: {
        search
      },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  removeElement (options: OverrideCommandOptions & {
    videoId: number
  }) {
    const { videoId } = options
    const path = '/api/v1/users/me/history/videos/' + videoId

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  removeAll (options: OverrideCommandOptions & {
    beforeDate?: string
  } = {}) {
    const { beforeDate } = options
    const path = '/api/v1/users/me/history/videos/remove'

    return this.postBodyRequest({
      ...options,

      path,
      fields: { beforeDate },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }
}
