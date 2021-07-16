import { HttpStatusCode, ResultList, Video } from '@shared/models'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

export class HistoryCommand extends AbstractCommand {

  wathVideo (options: OverrideCommandOptions & {
    videoId: number | string
    currentTime: number
  }) {
    const { videoId, currentTime } = options

    const path = '/api/v1/videos/' + videoId + '/watching'
    const fields = { currentTime }

    return this.putBodyRequest({
      ...options,

      path,
      fields,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

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

  remove (options: OverrideCommandOptions & {
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
