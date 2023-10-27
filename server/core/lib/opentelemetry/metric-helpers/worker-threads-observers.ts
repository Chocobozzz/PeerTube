import { Meter } from '@opentelemetry/api'
import { getWorkersStats } from '@server/lib/worker/parent-process.js'

export class WorkerThreadsObserversBuilder {

  constructor (private readonly meter: Meter) {

  }

  buildObservers () {
    this.meter.createObservableGauge('peertube_worker_thread_queue_total', {
      description: 'Total tasks waiting for a PeerTube worker thread'
    }).addCallback(observableResult => {
      const stats = getWorkersStats()

      for (const stat of stats) {
        observableResult.observe(stat.queueSize, { state: 'waiting', workerThread: stat.label })
      }
    })

    this.meter.createObservableGauge('peertube_worker_thread_completed_total', {
      description: 'Total tasks completed in PeerTube worker threads'
    }).addCallback(observableResult => {
      const stats = getWorkersStats()

      for (const stat of stats) {
        observableResult.observe(stat.completed, { workerThread: stat.label })
      }
    })
  }

}
