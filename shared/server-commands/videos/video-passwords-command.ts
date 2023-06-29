import { HttpStatusCode, ResultList, VideoPassword } from '@shared/models'
import { AbstractCommand, OverrideCommandOptions } from '../shared'
export class VideoPasswordsCommand extends AbstractCommand {

  list (options: OverrideCommandOptions & {
    videoId: number | string
    start?: number
    count?: number
    sort?: string
  }) {
    const { start, count, sort, videoId } = options
    const path = '/api/v1/videos/' + videoId + '/passwords'

    return this.getRequestBody<ResultList<VideoPassword>>({
      ...options,

      path,
      query: { start, count, sort },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  updateAll (options: OverrideCommandOptions & {
    videoId: number | string
    passwords: string[]
  }) {
    const { videoId, passwords } = options
    const path = `/api/v1/videos/${videoId}/passwords`

    return this.putBodyRequest({
      ...options,
      path,
      fields: { passwords },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  remove (options: OverrideCommandOptions & {
    id: number
    videoId: number | string
  }) {
    const { id, videoId } = options
    const path = `/api/v1/videos/${videoId}/passwords/${id}`

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }
}
