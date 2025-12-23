import { millisecondsToTime } from '@peertube/peertube-core-utils'
import { SUUID, buildAbsoluteFixturePath, buildSUUID } from '@peertube/peertube-node-utils'
import {
  TranscriptFile,
  TranscriptionEngine,
  TranscriptionEngineName,
  TranscriptionModel,
  transcriberFactory
} from '@peertube/peertube-transcription'
import { ensureDir, remove } from 'fs-extra/esm'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PerformanceObserver, performance } from 'node:perf_hooks'
import { createLogger, format, transports } from 'winston'
import { TranscriptFileEvaluator } from './transcript-file-evaluator.js'

interface BenchmarkResult {
  uuid: SUUID
  WER?: number
  CER?: number
  duration?: number
  engine?: TranscriptionEngine
  model?: string
}

type Benchmark = Record<SUUID, BenchmarkResult>

const benchmarkReducer = (benchmark: Benchmark = {}, benchmarkResult: BenchmarkResult) => ({
  ...benchmark,
  [benchmarkResult.uuid]:  {
    ...benchmark[benchmarkResult.uuid],
    ...benchmarkResult
  }
})

const groupBenchmarkResultsByModel = (benchmarkResults: Record<string, BenchmarkResult>) => (benchmarksGroupedByModel, uuid) => ({
  ...benchmarksGroupedByModel,
  [benchmarkResults[uuid].model]: {
    ...benchmarksGroupedByModel[benchmarkResults[uuid].model],
    [uuid]: formatBenchmarkResult(benchmarkResults[uuid])
  }
})

interface FormattedBenchmarkResult {
  WER?: string
  CER?: string
  duration?: string
  model?: string
  engine?: string
}

const formatBenchmarkResult = ({ WER, CER, duration, engine, model }: Partial<BenchmarkResult>): FormattedBenchmarkResult => ({
  WER: WER ? `${WER * 100}%` : undefined,
  CER: CER ? `${CER * 100}%` : undefined,
  duration: duration ? millisecondsToTime(duration) : undefined,
  model,
  engine: engine.name
})

void (async () => {
  const logger = createLogger()
  logger.add(new transports.Console({ format: format.printf(log => log.message as string) }))

  const transcribers: TranscriptionEngineName[] = [ 'openai-whisper', 'whisper-ctranslate2' ]
  const models = process.env.MODELS
    ? process.env.MODELS.trim().split(',').map(modelName => modelName.trim()).filter(modelName => modelName)
    : [ 'tiny' ]

  const transcriptDirectory = join(tmpdir(), 'peertube-transcription', 'benchmark')
  const pipDirectory = join(tmpdir(), 'peertube-transcription', 'pip')

  const mediaFilePath = buildAbsoluteFixturePath('transcription/videos/derive_sectaire.mp4')
  const referenceTranscriptFile = new TranscriptFile({
    path: buildAbsoluteFixturePath('transcription/videos/derive_sectaire.txt'),
    language: 'fr',
    format: 'txt'
  })

  let benchmarkResults: Record<string, BenchmarkResult> = {}

  // before
  await ensureDir(transcriptDirectory)
  const performanceObserver = new PerformanceObserver((items) => {
    items
      .getEntries()
      .forEach((entry) => {
        benchmarkResults = benchmarkReducer(benchmarkResults, {
          uuid: entry.name as SUUID,
          duration: entry.duration
        })
      })
  })
  performanceObserver.observe({ type: 'measure' })

  // benchmark
  logger.info(`Running transcribers benchmark with the following models: ${models.join(', ')}`)
  for (const transcriberName of transcribers) {
    logger.info(`Create "${transcriberName}" transcriber for the benchmark...`)

    const transcriber = transcriberFactory.createFromEngineName({
      engineName: transcriberName,
      logger: createLogger({ transports: [ new transports.Console() ] }),
      binDirectory: join(pipDirectory, 'bin')
    })

    await transcriber.install(pipDirectory)

    for (const modelName of models) {
      logger.info(`Run benchmark with "${modelName}" model:`)
      const model = new TranscriptionModel(modelName)
      const uuid = buildSUUID()
      const transcriptFile = await transcriber.transcribe({
        mediaFilePath,
        model,
        transcriptDirectory,
        language: 'fr',
        format: 'txt',
        runId: uuid
      })
      const evaluator = new TranscriptFileEvaluator(referenceTranscriptFile, transcriptFile)
      await new Promise(resolve => setTimeout(resolve, 1))

      benchmarkResults = benchmarkReducer(benchmarkResults, {
        uuid,
        engine: transcriber.engine,
        WER: await evaluator.wer(),
        CER: await evaluator.cer(),
        model: model.name
      })
    }
  }

  // display
  const benchmarkResultsGroupedByModel = Object
    .keys(benchmarkResults)
    .reduce(groupBenchmarkResultsByModel(benchmarkResults), {})
  Object.values(benchmarkResultsGroupedByModel).forEach(benchmark => console.table(benchmark))

  // after
  await remove(transcriptDirectory)
  performance.clearMarks()
})()
