import { Meter, ObservableResult } from '@opentelemetry/api'
import { AggregationType, InstrumentType, ViewOptions } from '@opentelemetry/sdk-metrics'
import { createLogger } from '@server/helpers/logger.js'
import { readdir } from 'fs/promises'
import { constants, monitorEventLoopDelay, NodeGCPerformanceDetail, performance, PerformanceObserver } from 'perf_hooks'
import * as process from 'process'

const logger = createLogger()

// Thanks to https://github.com/siimon/prom-client
// We took their logic and adapter it for opentelemetry
// Try to keep consistency with their metric name/description so it's easier to process (grafana dashboard template etc)

export class NodeJSObserversBuilder {
  constructor (private readonly meter: Meter) {
  }

  static getViews (): ViewOptions[] {
    return [
      {
        instrumentType: InstrumentType.HISTOGRAM,
        instrumentName: 'nodejs_gc_duration_seconds',
        aggregation: {
          type: AggregationType.EXPLICIT_BUCKET_HISTOGRAM,
          options: {
            boundaries: [ 0.001, 0.01, 0.1, 1, 2, 5 ]
          }
        }
      }
    ]
  }

  buildObservers () {
    this.buildCPUObserver()
    this.buildMemoryObserver()

    this.buildHandlesObserver()
    this.buildFileDescriptorsObserver()

    this.buildGCObserver()
    this.buildEventLoopLagObserver()
    this.buildEventLoopDelayObserver()
    this.buildEventLoopUtilizationObserver()

    this.buildLibUVActiveRequestsObserver()
    this.buildActiveResourcesObserver()
  }

  private buildCPUObserver () {
    const cpuTotal = this.meter.createObservableCounter('process_cpu_seconds_total', {
      description: 'Total user and system CPU time spent in seconds.'
    })
    const cpuUser = this.meter.createObservableCounter('process_cpu_user_seconds_total', {
      description: 'Total user CPU time spent in seconds.'
    })
    const cpuSystem = this.meter.createObservableCounter('process_cpu_system_seconds_total', {
      description: 'Total system CPU time spent in seconds.'
    })

    // Observable counters report the cumulative value: the CPU time since the process started
    this.meter.addBatchObservableCallback(observableResult => {
      const { user, system } = process.cpuUsage()

      observableResult.observe(cpuTotal, (user + system) / 1e6)
      observableResult.observe(cpuUser, user / 1e6)
      observableResult.observe(cpuSystem, system / 1e6)
    }, [ cpuTotal, cpuUser, cpuSystem ])
  }

  private buildMemoryObserver () {
    this.meter.createObservableGauge('nodejs_memory_usage_bytes', {
      description: 'Memory'
    }).addCallback(observableResult => {
      const current = process.memoryUsage()

      observableResult.observe(current.heapTotal, { memoryType: 'heapTotal' })
      observableResult.observe(current.heapUsed, { memoryType: 'heapUsed' })
      observableResult.observe(current.arrayBuffers, { memoryType: 'arrayBuffers' })
      observableResult.observe(current.external, { memoryType: 'external' })
      observableResult.observe(current.rss, { memoryType: 'rss' })
    })
  }

  private buildHandlesObserver () {
    if (typeof (process as any)._getActiveHandles !== 'function') return

    this.meter.createObservableGauge('nodejs_active_handles_total', {
      description: 'Total number of active handles.'
    }).addCallback(observableResult => {
      const handles = (process as any)._getActiveHandles()

      observableResult.observe(handles.length)
    })
  }

  private buildGCObserver () {
    const kinds = {
      [constants.NODE_PERFORMANCE_GC_MAJOR]: 'major',
      [constants.NODE_PERFORMANCE_GC_MINOR]: 'minor',
      [constants.NODE_PERFORMANCE_GC_INCREMENTAL]: 'incremental',
      [constants.NODE_PERFORMANCE_GC_WEAKCB]: 'weakcb'
    }

    const histogram = this.meter.createHistogram('nodejs_gc_duration_seconds', {
      description: 'Garbage collection duration by kind, one of major, minor, incremental or weakcb'
    })

    const obs = new PerformanceObserver(list => {
      const entry = list.getEntries()[0]

      const kind = kinds[(entry.detail as NodeGCPerformanceDetail).kind]

      // Convert duration from milliseconds to seconds
      histogram.record(entry.duration / 1000, {
        kind
      })
    })

    obs.observe({ entryTypes: [ 'gc' ] })
  }

  private buildEventLoopLagObserver () {
    const reportEventLoopLag = (start: [number, number], observableResult: ObservableResult, res: () => void) => {
      const delta = process.hrtime(start)
      const nanosec = delta[0] * 1e9 + delta[1]
      const seconds = nanosec / 1e9

      observableResult.observe(seconds)

      res()
    }

    this.meter.createObservableGauge('nodejs_eventloop_lag_seconds', {
      description: 'Lag of event loop in seconds.'
    }).addCallback(observableResult => {
      return new Promise(res => {
        const start = process.hrtime()

        setImmediate(reportEventLoopLag, start, observableResult, res)
      })
    })
  }

  // Distribution of the event loop delays since the previous collection, sampled every 10ms
  private buildEventLoopDelayObserver () {
    const histogram = monitorEventLoopDelay({ resolution: 10 })
    histogram.enable()

    const gauges = {
      min: 'Minimum',
      max: 'Maximum',
      mean: 'Mean',
      stddev: 'Standard deviation of',
      p50: '50th percentile of',
      p90: '90th percentile of',
      p99: '99th percentile of'
    }

    const instruments = Object.entries(gauges).map(([ key, description ]) => {
      return {
        key,
        gauge: this.meter.createObservableGauge(`nodejs_eventloop_lag_${key}_seconds`, {
          description: `${description} the recorded event loop delays.`
        })
      }
    })

    this.meter.addBatchObservableCallback(observableResult => {
      if (histogram.count === 0) return

      for (const { key, gauge } of instruments) {
        const nanoseconds = key.startsWith('p')
          ? histogram.percentile(parseInt(key.substring(1), 10))
          : histogram[key as 'min' | 'max' | 'mean' | 'stddev']

        observableResult.observe(gauge, nanoseconds / 1e9)
      }

      histogram.reset()
    }, instruments.map(i => i.gauge))
  }

  private buildEventLoopUtilizationObserver () {
    let last = performance.eventLoopUtilization()

    this.meter.createObservableGauge('nodejs_eventloop_utilization_ratio', {
      description: 'Ratio of time the event loop was busy since the previous collection.'
    }).addCallback(observableResult => {
      const current = performance.eventLoopUtilization()

      observableResult.observe(performance.eventLoopUtilization(current, last).utilization)

      last = current
    })
  }

  private buildFileDescriptorsObserver () {
    this.meter.createObservableGauge('process_open_fds', {
      description: 'Number of open file descriptors.'
    }).addCallback(async observableResult => {
      try {
        const fds = await readdir('/proc/self/fd')
        observableResult.observe(fds.length - 1)
      } catch (err) {
        logger.debug('Cannot list file descriptors of current process for OpenTelemetry.', { err })
      }
    })
  }

  private buildLibUVActiveRequestsObserver () {
    if (typeof (process as any)._getActiveRequests !== 'function') return

    this.meter.createObservableGauge('nodejs_active_requests_total', {
      description: 'Total number of active libuv requests.'
    }).addCallback(observableResult => {
      const requests = (process as any)._getActiveRequests()

      observableResult.observe(requests.length)
    })
  }

  private buildActiveResourcesObserver () {
    if (typeof (process as any).getActiveResourcesInfo !== 'function') return

    this.meter.createObservableGauge('nodejs_active_resources_total', {
      description: 'Number of active resources that are currently keeping the event loop alive, grouped by async resource type.'
    }).addCallback(observableResult => {
      const resources = (process as any).getActiveResourcesInfo()

      const data = {}

      // oxlint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < resources.length; i++) {
        const resource = resources[i]

        if (data[resource] === undefined) data[resource] = 0
        data[resource] += 1
      }

      for (const type of Object.keys(data)) {
        observableResult.observe(data[type], { type })
      }
    })
  }
}
