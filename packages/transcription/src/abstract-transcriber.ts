import { SimpleLogger } from '@peertube/peertube-models'
import { buildSUUID, SUUID } from '@peertube/peertube-node-utils'
import { $ } from 'execa'
import { PerformanceObserver } from 'node:perf_hooks'
import { join } from 'path'
import { TranscriptFile, TranscriptFormat } from './transcript-file.js'
import { TranscriptionEngine } from './transcription-engine.js'
import { TranscriptionModel } from './transcription-model.js'
import { TranscriptionRun } from './transcription-run.js'

export interface TranscribeArgs {
  mediaFilePath: string
  model: TranscriptionModel
  format: TranscriptFormat
  transcriptDirectory: string

  language?: string
  runId?: SUUID
}

export abstract class AbstractTranscriber {
  engine: TranscriptionEngine

  protected binDirectory: string
  protected enginePath: string

  protected logger: SimpleLogger

  protected performanceObserver?: PerformanceObserver
  protected run?: TranscriptionRun

  constructor (options: {
    engine: TranscriptionEngine
    binDirectory?: string
    enginePath?: string

    logger: SimpleLogger
    performanceObserver?: PerformanceObserver
  }) {
    const { engine, logger, enginePath, binDirectory, performanceObserver } = options

    this.engine = engine
    this.enginePath = enginePath
    this.logger = logger
    this.binDirectory = binDirectory
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

  protected getEngineBinary () {
    if (this.enginePath) return this.enginePath
    if (this.binDirectory) return join(this.binDirectory, this.engine.command)

    return this.engine.command
  }

  protected getExec (env?: { [ id: string ]: string }) {
    const logLevels = {
      command: 'debug',
      output: 'debug',
      ipc: 'debug',
      error: 'error',
      duration: 'debug'
    }

    return $({
      verbose: (_verboseLine, { message, ...verboseObject }) => {
        const level = logLevels[verboseObject.type]

        this.logger[level](message, verboseObject)
      },

      env
    })
  }

  abstract transcribe (options: TranscribeArgs): Promise<TranscriptFile>

  abstract install (path: string): Promise<void>
}
