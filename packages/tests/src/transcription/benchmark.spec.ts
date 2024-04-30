import { createLogger } from 'winston'
import short, { SUUID } from 'short-uuid'
import { performance, PerformanceObserver } from 'node:perf_hooks'
// import { CpuInfo, CpuUsage } from 'node:os'
import { rm, mkdir } from 'node:fs/promises'
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import {
  toHumanReadable,
  transcriberFactory,
  TranscriptFile,
  TranscriptFileEvaluator,
  TranscriptionEngine
} from '@peertube/peertube-transcription'

interface TestResult {
  uuid: SUUID
  WER?: number
  CER?: number
  duration?: number
  engine?: TranscriptionEngine
  model?: string
  // dataThroughput: number // relevant ?
  // cpus: CpuInfo[] // https://nodejs.org/docs/latest-v18.x/api/os.html#oscpus
  // cpuUsages: CpuUsage[] // https://nodejs.org/docs/latest-v18.x/api/process.html#processcpuusagepreviousvalue
  // // os.totalmem()
  // // os.freemem()
  // memoryUsages: Record<number, MemoryUsage> // https://nodejs.org/docs/latest-v18.x/api/process.html#processmemoryusage
}

type Benchmark = Record<SUUID, TestResult>

const benchmarkReducer = (benchmark: Benchmark = {}, testResult: TestResult) => ({
  ...benchmark,
  [testResult.uuid]:  {
    ...benchmark[testResult.uuid],
    ...testResult
  }
})

interface FormattedTestResult {
  WER?: string
  CER?: string
  duration?: string
  model?: string
  engine?: string
}

const formatTestResult = ({ WER, CER, duration, engine, model }: Partial<TestResult>): FormattedTestResult => ({
  WER: WER ? `${WER * 100}%` : undefined,
  CER: CER ? `${CER * 100}%` : undefined,
  duration: duration ? toHumanReadable(duration) : undefined,
  model,
  engine: engine.name
})

describe('Transcribers benchmark', function () {
  const transcribers = [
    'openai-whisper',
    'whisper-ctranslate2',
    'whisper-timestamped'
  ]
  const models = [
    'tiny',
    'small'
  ]

  const transcriptDirectory = buildAbsoluteFixturePath('transcription/benchmark/')
  const mediaFilePath = buildAbsoluteFixturePath('transcription/videos/communiquer-lors-dune-classe-transplantee.mp4')
  const referenceTranscriptFile = new TranscriptFile({
    path: buildAbsoluteFixturePath('transcription/transcript/reference.txt'),
    language: 'fr',
    format: 'txt'
  })

  let benchmark: Record<string, TestResult> = {}

  before(async function () {
    await mkdir(transcriptDirectory, { recursive: true })

    const performanceObserver = new PerformanceObserver((items) => {
      items
        .getEntries()
        .forEach((entry) => {
          benchmark = benchmarkReducer(benchmark, {
            uuid: entry.name as SUUID,
            duration: entry.duration
          })
        })
    })
    performanceObserver.observe({ type: 'measure' })
  })

  transcribers.forEach(function (transcriberName) {
    describe(`Creates a ${transcriberName} transcriber for the benchmark`, function () {
      const transcriber = transcriberFactory.createFromEngineName(
        transcriberName,
        createLogger(),
        transcriptDirectory
      )

      models.forEach((modelName) => {
        it(`Run ${transcriberName} transcriber benchmark with ${modelName} model`, async function () {
          this.timeout(15 * 1000 * 60) // 15 minutes
          const model = { name: modelName }
          const uuid = short.generate()
          const transcriptFile = await transcriber.transcribe(mediaFilePath, model, 'fr', 'txt', uuid)
          const evaluator = new TranscriptFileEvaluator(referenceTranscriptFile, transcriptFile)
          await new Promise(resolve => setTimeout(resolve, 1))

          benchmark = benchmarkReducer(benchmark, {
            uuid,
            engine: transcriber.engine,
            WER: await evaluator.wer(),
            CER: await evaluator.cer(),
            model: model.name
          })
        })
      })
    })
  })

  after(async function () {
    const benchmarksGroupedByModel = Object
        .keys(benchmark)
        .reduce((benchmarksGroupedByModel, uuid, currentIndex, array) => ({
          ...benchmarksGroupedByModel,
          [benchmark[uuid].model]: {
            ...benchmarksGroupedByModel[benchmark[uuid].model],
            [uuid]: formatTestResult(benchmark[uuid])
          }
        }), {})
    Object.values(benchmarksGroupedByModel).forEach(benchmark => console.table(benchmark))

    await rm(transcriptDirectory, { recursive: true, force: true })

    performance.clearMarks()
  })
})
