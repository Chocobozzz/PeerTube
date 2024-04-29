import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { PerformanceObserver } from 'node:perf_hooks'
import assert from 'node:assert'
import { createLogger, Logger } from 'winston'
import short from 'short-uuid'
import { root } from '@peertube/peertube-node-utils'
import { TranscriptionEngine } from './transcription-engine.js'
import { TranscriptionModel } from './transcription-model.js'
import { TranscriptFile, TranscriptFormat } from './transcript/index.js'

export abstract class AbstractTranscriber {
  public static DEFAULT_TRANSCRIPT_DIRECTORY = join(root(), 'dist', 'transcripts')

  engine: TranscriptionEngine
  logger: Logger
  transcriptDirectory: string
  performanceObserver?: PerformanceObserver
  runId?: string

  constructor (
    engine: TranscriptionEngine,
    logger: Logger = createLogger(),
    transcriptDirectory: string = AbstractTranscriber.DEFAULT_TRANSCRIPT_DIRECTORY,
    performanceObserver?: PerformanceObserver
  ) {
    this.engine = engine
    this.logger = logger
    this.transcriptDirectory = transcriptDirectory
    this.performanceObserver = performanceObserver
  }

  detectLanguage () {
    return Promise.resolve('')
  }

  loadModel (model: TranscriptionModel) {
    if (existsSync(model.path)) { /* empty */ }
  }

  supports (model: TranscriptionModel) {
    return model.format === 'PyTorch'
  }

  createPerformanceMark () {
    this.runId = `${short.uuid()}-${this.engine.name}`
    performance.mark(this.getStartPerformanceMarkName())
  }

  measurePerformanceMark () {
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
    assert(!!this.runId, 'Each transcription run should have an id.')

    return `${this.runId}-started`
  }

  getEndPerformanceMarkName () {
    assert(!!this.runId, 'Each transcription run should have an id.')

    return `${this.runId}-ended`
  }

  abstract transcribe (
    mediaFilePath: string,
    model: TranscriptionModel,
    language: string,
    format: TranscriptFormat
  ): Promise<TranscriptFile>
}
