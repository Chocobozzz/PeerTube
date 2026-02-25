import { Meter } from '@opentelemetry/api'
import { RunnerJobModel } from '@server/models/runner/runner-job.js'

export class RunnerJobQueueObserversBuilder {

  constructor (private readonly meter: Meter) {

  }

  buildObservers () {
    this.meter.createObservableGauge('peertube_runner_job_queue_total', {
      description: 'Total jobs in the PeerTube runner job queue'
    }).addCallback(async observableResult => {
      const stats = await RunnerJobModel.getStats()

      for (const { jobType, state, count } of stats) {
        observableResult.observe(count, { jobType, state })
      }
    })
  }

}
