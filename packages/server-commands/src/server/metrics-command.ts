import { HttpStatusCode, PlaybackMetricCreate } from '@peertube/peertube-models'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class MetricsCommand extends AbstractCommand {

  addPlaybackMetric (options: OverrideCommandOptions & { metrics: PlaybackMetricCreate }) {
    const path = '/api/v1/metrics/playback'

    return this.postBodyRequest({
      ...options,

      path,
      fields: options.metrics,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }
}
