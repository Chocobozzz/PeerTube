import { Meter } from '@opentelemetry/api-metrics'
import { VideoScope, ViewerScope } from '@server/lib/views/shared'
import { VideoViewsManager } from '@server/lib/views/video-views-manager'

export class ViewersObserversBuilder {

  constructor (private readonly meter: Meter) {

  }

  buildObservers () {
    this.meter.createObservableGauge('peertube_viewers_total', {
      description: 'Total viewers on the instance'
    }).addCallback(observableResult => {
      for (const viewerScope of [ 'local', 'remote' ] as ViewerScope[]) {
        for (const videoScope of [ 'local', 'remote' ] as VideoScope[]) {
          const result = VideoViewsManager.Instance.getTotalViewers({ viewerScope, videoScope })

          observableResult.observe(result, { viewerOrigin: viewerScope, videoOrigin: videoScope })
        }
      }
    })
  }
}
