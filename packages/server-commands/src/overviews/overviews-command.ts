import { HttpStatusCode, VideosOverview } from '@peertube/peertube-models'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class OverviewsCommand extends AbstractCommand {

  getVideos (options: OverrideCommandOptions & {
    page: number
  }) {
    const { page } = options
    const path = '/api/v1/overviews/videos'

    const query = { page }

    return this.getRequestBody<VideosOverview>({
      ...options,

      path,
      query,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }
}
