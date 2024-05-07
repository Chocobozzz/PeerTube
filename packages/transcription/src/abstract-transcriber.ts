import { createLogger, Logger } from 'winston'
import { join } from 'node:path'
import { PerformanceObserver } from 'node:perf_hooks'
import { buildSUUID, SUUID, root } from '@peertube/peertube-node-utils'
import { TranscriptionEngine } from './transcription-engine.js'
import { TranscriptionModel } from './transcription-model.js'
import { TranscriptionRun } from './transcription-run.js'
import { TranscriptFile, TranscriptFormat } from './transcript/index.js'

export interface TranscribeArgs {
  mediaFilePath: string
  model: TranscriptionModel
  language?: string
  format?: TranscriptFormat
  runId?: SUUID
}

export abstract class AbstractTranscriber {
  public static DEFAULT_TRANSCRIPT_DIRECTORY = join(root(), 'dist', 'transcripts')

  engine: TranscriptionEngine
  logger: Logger
  transcriptDirectory: string
  performanceObserver?: PerformanceObserver
  run?: TranscriptionRun

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

  createRun (uuid: SUUID = buildSUUID()) {
    this.run = new TranscriptionRun(this.logger, uuid)
  }

  startRun () {
    this.run.start()
  }

  stopRun () {
    this.run.stop()
    delete this.run
  }

  assertLanguageDetectionAvailable (language?: string) {
    if (!this.engine.languageDetection && !language) {
      throw new Error(`Language detection isn't available in ${this.engine.name}. A language must me provided explicitly.`)
    }
  }

  supports (model: TranscriptionModel) {
    return model.format === 'PyTorch'
  }

  abstract transcribe ({
    mediaFilePath,
    model,
    language,
    format = 'vtt',
    runId = buildSUUID()
  }: TranscribeArgs): Promise<TranscriptFile>
}
