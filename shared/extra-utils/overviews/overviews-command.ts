import { HttpStatusCode } from '@shared/core-utils'
import { VideosOverview } from '@shared/models'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

export class OverviewsCommand extends AbstractCommand {

  getVideos (options: OverrideCommandOptions & {
    page: number
  }) {
    const { token, page } = options
    const path = '/api/v1/overviews/videos'

    const query = { page }

    return this.getRequestBody<VideosOverview>({
      ...options,

      token: token || null,
      path,
      query,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }
}
