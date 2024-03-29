import { buildSUUID, SUUID } from '@peertube/peertube-node-utils'
import { createLogger, Logger } from 'winston'

export class TranscriptionRun {
  uuid: SUUID
  logger: Logger

  constructor (logger = createLogger(), uuid: SUUID = buildSUUID()) {
    this.uuid = uuid
    this.logger = logger
  }

  get runId () {
    return this.uuid
  }

  start () {
    performance.mark(this.getStartPerformanceMarkName())
  }

  stop () {
    try {
      performance.mark(this.getEndPerformanceMarkName())
      performance.measure(
        this.runId,
        this.getStartPerformanceMarkName(),
        this.getEndPerformanceMarkName()
      )
    } catch (e) {
      this.logger.log({ level: 'error', message: e })
    }
  }

  getStartPerformanceMarkName () {
    return `${this.runId}-started`
  }

  getEndPerformanceMarkName () {
    return `${this.runId}-ended`
  }
}
