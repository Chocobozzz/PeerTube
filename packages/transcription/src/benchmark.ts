import { createLogger, transports, format } from 'winston'
import { join } from 'node:path'
import { performance, PerformanceObserver } from 'node:perf_hooks'
import { tmpdir } from 'node:os'
import { rm, mkdir } from 'node:fs/promises'
import { buildAbsoluteFixturePath, buildSUUID, SUUID } from '@peertube/peertube-node-utils'
import {
  transcriberFactory,
  TranscriptFile,
  TranscriptFileEvaluator,
  TranscriptionEngine,
  TranscriptionModel
} from '@peertube/peertube-transcription'
import { millisecondsToTime } from '@peertube/peertube-core-utils'

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
  logger.add(new transports.Console({ format: format.printf(log => log.message) }))
  const transcribers = [
    'openai-whisper',
    'whisper-ctranslate2',
    'whisper-timestamped'
  ]
  const models = process.env.MODELS
    ? process.env.MODELS.trim().split(',').map(modelName => modelName.trim()).filter(modelName => modelName)
    : [ 'tiny' ]

  const transcriptDirectory = join(tmpdir(), 'peertube-transcription/benchmark/')
  const mediaFilePath = buildAbsoluteFixturePath('transcription/videos/derive_sectaire.mp4')
  const referenceTranscriptFile = new TranscriptFile({
    path: buildAbsoluteFixturePath('transcription/videos/derive_sectaire.txt'),
    language: 'fr',
    format: 'txt'
  })

  let benchmarkResults: Record<string, BenchmarkResult> = {}

  // before
  await mkdir(transcriptDirectory, { recursive: true })
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

    const transcriber = transcriberFactory.createFromEngineName(
      transcriberName,
      createLogger(),
      transcriptDirectory
    )

    for (const modelName of models) {
      logger.info(`Run benchmark with "${modelName}" model:`)
      const model = new TranscriptionModel(modelName)
      const uuid = buildSUUID()
      const transcriptFile = await transcriber.transcribe({
        mediaFilePath,
        model,
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
  await rm(transcriptDirectory, { recursive: true, force: true })
  performance.clearMarks()
})()
