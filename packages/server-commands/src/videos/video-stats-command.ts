import { pick } from '@peertube/peertube-core-utils'
import {
  HttpStatusCode,
  VideoStatsOverall,
  VideoStatsRetention,
  VideoStatsTimeserie,
  VideoStatsTimeserieMetric,
  VideoStatsUserAgent
} from '@peertube/peertube-models'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class VideoStatsCommand extends AbstractCommand {
  getOverallStats (
    options: OverrideCommandOptions & {
      videoId: number | string
      startDate?: string
      endDate?: string
    }
  ) {
    const path = '/api/v1/videos/' + options.videoId + '/stats/overall'

    return this.getRequestBody<VideoStatsOverall>({
      ...options,
      path,

      query: pick(options, [ 'startDate', 'endDate' ]),

      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  getUserAgentStats (
    options: OverrideCommandOptions & {
      videoId: number | string
      startDate?: string
      endDate?: string
    }
  ) {
    const path = '/api/v1/videos/' + options.videoId + '/stats/user-agent'

    return this.getRequestBody<VideoStatsUserAgent>({
      ...options,
      path,

      query: pick(options, [ 'startDate', 'endDate' ]),

      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  getTimeserieStats (
    options: OverrideCommandOptions & {
      videoId: number | string
      metric: VideoStatsTimeserieMetric
      startDate?: Date
      endDate?: Date
    }
  ) {
    const path = '/api/v1/videos/' + options.videoId + '/stats/timeseries/' + options.metric

    return this.getRequestBody<VideoStatsTimeserie>({
      ...options,
      path,

      query: pick(options, [ 'startDate', 'endDate' ]),
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  getRetentionStats (
    options: OverrideCommandOptions & {
      videoId: number | string
    }
  ) {
    const path = '/api/v1/videos/' + options.videoId + '/stats/retention'

    return this.getRequestBody<VideoStatsRetention>({
      ...options,
      path,

      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }
}
