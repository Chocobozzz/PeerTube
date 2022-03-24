import { HttpStatusCode, VideoStatsOverall, VideoStatsRetention, VideoStatsTimeserie, VideoStatsTimeserieMetric } from '@shared/models'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

export class VideoStatsCommand extends AbstractCommand {

  getOverallStats (options: OverrideCommandOptions & {
    videoId: number | string
  }) {
    const path = '/api/v1/videos/' + options.videoId + '/stats/overall'

    return this.getRequestBody<VideoStatsOverall>({
      ...options,
      path,

      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  getTimeserieStats (options: OverrideCommandOptions & {
    videoId: number | string
    metric: VideoStatsTimeserieMetric
  }) {
    const path = '/api/v1/videos/' + options.videoId + '/stats/timeseries/' + options.metric

    return this.getRequestBody<VideoStatsTimeserie>({
      ...options,
      path,

      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  getRetentionStats (options: OverrideCommandOptions & {
    videoId: number | string
  }) {
    const path = '/api/v1/videos/' + options.videoId + '/stats/retention'

    return this.getRequestBody<VideoStatsRetention>({
      ...options,
      path,

      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }
}
