import { Meter } from '@opentelemetry/api'
import { RunnerJobState } from '@peertube/peertube-models'
import { runnerJobTypes } from '@server/lib/runners/job-handlers/runner-job-handlers.js'
import { RunnerJobModel } from '@server/models/runner/runner-job.js'

const stateLabels = Object.fromEntries(
  Object.entries(RunnerJobState).map(([ key, value ]) => [ value, key.toLowerCase() ])
) as Record<number, string>

export class RunnerJobQueueObserversBuilder {

  constructor (private readonly meter: Meter) {

  }

  buildObservers () {
    this.meter.createObservableGauge('peertube_runner_job_queue_total', {
      description: 'Total jobs in the PeerTube runner job queue'
    }).addCallback(async observableResult => {
      const stats = await RunnerJobModel.getStats()

      const countMap = new Map(
        stats.map(({ jobType, state, count }) => [ `${jobType}:${state}`, count ])
      )

      for (const jobType of runnerJobTypes) {
        for (const [ stateNum, stateLabel ] of Object.entries(stateLabels)) {
          const count = countMap.get(`${jobType}:${stateNum}`) ?? 0
          observableResult.observe(count, { jobType, state: stateLabel })
        }
      }
    })
  }

}
