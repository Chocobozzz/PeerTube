import { Meter } from '@opentelemetry/api'
import { RunnerModel } from '@server/models/runner/runner.js'

export class RunnerObserversBuilder {

  constructor (private readonly meter: Meter) {

  }

  buildObservers () {
    const runnerCount = this.meter.createObservableGauge('peertube_runner_count', {
      description: 'Number of registered PeerTube runners'
    })

    const runnerInfo = this.meter.createObservableGauge('peertube_runner_info', {
      description: 'PeerTube runner metadata'
    })

    const secondsSinceLastContact = this.meter.createObservableGauge('peertube_runner_seconds_since_last_contact', {
      description: 'Seconds since the PeerTube runner last checked in',
      unit: 's'
    })

    this.meter.addBatchObservableCallback(async observableResult => {
      const runners = await RunnerModel.listAll()

      observableResult.observe(runnerCount, runners.length)

      for (const runner of runners) {
        const secondsSinceContact = (Date.now() - runner.lastContact.getTime()) / 1000

        observableResult.observe(secondsSinceLastContact, secondsSinceContact, { runnerName: runner.name })
        observableResult.observe(runnerInfo, 1, {
          runnerName: runner.name,
          description: runner.description ?? '',
          ip: runner.ip,
          version: runner.version ?? 'unknown',
          createdAt: runner.createdAt.toISOString()
        })
      }
    }, [ runnerCount, runnerInfo, secondsSinceLastContact ])
  }

}
