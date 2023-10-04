import { Meter } from '@opentelemetry/api'
import { JobQueue } from '@server/lib/job-queue/index.js'

export class JobQueueObserversBuilder {

  constructor (private readonly meter: Meter) {

  }

  buildObservers () {
    this.meter.createObservableGauge('peertube_job_queue_total', {
      description: 'Total jobs in the PeerTube job queue'
    }).addCallback(async observableResult => {
      const stats = await JobQueue.Instance.getStats()

      for (const { jobType, counts } of stats) {
        for (const state of Object.keys(counts)) {
          observableResult.observe(counts[state], { jobType, state })
        }
      }
    })
  }

}
