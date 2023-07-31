import { HttpStatusCode, ResultList, VideoRedundanciesTarget, VideoRedundancy } from '@peertube/peertube-models'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class RedundancyCommand extends AbstractCommand {

  updateRedundancy (options: OverrideCommandOptions & {
    host: string
    redundancyAllowed: boolean
  }) {
    const { host, redundancyAllowed } = options
    const path = '/api/v1/server/redundancy/' + host

    return this.putBodyRequest({
      ...options,

      path,
      fields: { redundancyAllowed },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  listVideos (options: OverrideCommandOptions & {
    target: VideoRedundanciesTarget
    start?: number
    count?: number
    sort?: string
  }) {
    const path = '/api/v1/server/redundancy/videos'

    const { target, start, count, sort } = options

    return this.getRequestBody<ResultList<VideoRedundancy>>({
      ...options,

      path,

      query: {
        start: start ?? 0,
        count: count ?? 5,
        sort: sort ?? 'name',
        target
      },

      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  addVideo (options: OverrideCommandOptions & {
    videoId: number
  }) {
    const path = '/api/v1/server/redundancy/videos'
    const { videoId } = options

    return this.postBodyRequest({
      ...options,

      path,
      fields: { videoId },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  removeVideo (options: OverrideCommandOptions & {
    redundancyId: number
  }) {
    const { redundancyId } = options
    const path = '/api/v1/server/redundancy/videos/' + redundancyId

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }
}
