import { SimpleLogger } from '@peertube/peertube-models'
import { buildSUUID, SUUID } from '@peertube/peertube-node-utils'
import { createLogger } from 'winston'

export class TranscriptionRun {
  uuid: SUUID
  logger: SimpleLogger

  constructor (logger: SimpleLogger = createLogger(), uuid: SUUID = buildSUUID()) {
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
    } catch (err) {
      this.logger.error(err.message, { err })
    }
  }

  getStartPerformanceMarkName () {
    return `${this.runId}-started`
  }

  getEndPerformanceMarkName () {
    return `${this.runId}-ended`
  }
}
