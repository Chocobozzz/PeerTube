import { HttpStatusCode, PlaybackMetricCreate } from '@shared/models'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

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
