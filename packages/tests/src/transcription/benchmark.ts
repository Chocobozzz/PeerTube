import { createLogger } from 'winston'
import { join } from 'path'
import { rm, mkdir } from 'node:fs/promises'
import { buildAbsoluteFixturePath, root } from '@peertube/peertube-node-utils'
import { toHumanReadable, transcriberFactory, TranscriptionEngine } from '@peertube/peertube-transcription'
import { performance, PerformanceObserver } from 'node:perf_hooks'
import { CpuInfo, CpuUsage } from 'node:os'

const WER_TOLERANCE = 1
const CER_TOLERANCE = 1

interface TestResult {
  WER: number
  CER: number
  duration: number
  engine: TranscriptionEngine
  dataThroughput: number // relevant ?
  cpus: CpuInfo[]
  cpuUsages: CpuUsage[]
  /**
   * {
   *  rss: 4935680,
   *  heapTotal: 1826816,
   *  heapUsed: 650472,
   *  external: 49879,
   *  arrayBuffers: 9386
   * }
   *
   * - `heapTotal` and `heapUsed` refer to V8's memory usage.
   * - `external` refers to the memory usage of C++ objects bound to JavaScript objects managed by V8.
   * - `rss`, Resident Set Size, is the amount of space occupied in the main memory device
   * (that is a subset of the total allocated memory) for the process, including all C++ and JavaScript objects and code.
   * - `arrayBuffers` refers to memory allocated for ArrayBuffers and SharedArrayBuffers, including all Node.js Buffers.
   * This is also included in the external value.
   * When Node.js is used as an embedded library, this value may be 0 because allocations for ArrayBuffers may not be tracked in that case.
   *
   * When using Worker threads, rss will be a value that is valid for the entire process,
   * while the other fields will only refer to the current thread.
   *
   * The process.memoryUsage() method iterates over each page to gather information about memory usage
   * which might be slow depending on the program memory allocations.
   */
  memoryUsages: Record<number, MemoryUsage>
}

// var os = require('os');
//
// console.log(os.cpus())
// console.log(os.totalmem());
// console.log(os.freemem())
//
// const testsResults: Record<string, TestResult> = {
//   cpus: []
// }
//
// async function testTranscriptGeneration (transformerBackend: string, model: string, mediaFilePath: string) {
//   const testResults = {
//     WER: 3,
//     CER: 3,
//     duration: 3
//   }
//
//   return testResults
// }

describe('Transcribers benchmark', function () {
  const transcriptDirectory = join(root(), 'test-transcript')
  const mediaFilePath = buildAbsoluteFixturePath('video_short.mp4')
  const transcribers = [
    'openai-whisper',
    'whisper-ctranslate2',
    'whisper-timestamped'
  ]

  before(async function () {
    await mkdir(transcriptDirectory, { recursive: true })

    const performanceObserver = new PerformanceObserver((items) => {
      items
        .getEntries()
        .forEach((entry) => console.log(`Transcription ${entry.name} took ${toHumanReadable(entry.duration)}`))
    })
    performanceObserver.observe({ type: 'measure' })
  })

  transcribers.forEach(function (transcriberName) {
    describe(`${transcriberName}`, function () {
      it('Should run transcription on a media file without raising any errors', async function () {
        const transcriber = transcriberFactory.createFromEngineName(
          transcriberName,
          createLogger(),
          transcriptDirectory
        )
        await transcriber.transcribe(mediaFilePath)
      })
    })
  })

  after(async function () {
    await rm(transcriptDirectory, { recursive: true, force: true })
    performance.clearMarks()
  })
})
