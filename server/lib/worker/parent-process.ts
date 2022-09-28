import { join } from 'path'
import Piscina from 'piscina'
import { processImage } from '@server/helpers/image-utils'
import { WORKER_THREADS } from '@server/initializers/constants'
import { httpBroadcast } from './workers/http-broadcast'
import { downloadImage } from './workers/image-downloader'

let downloadImageWorker: Piscina

function downloadImageFromWorker (options: Parameters<typeof downloadImage>[0]): Promise<ReturnType<typeof downloadImage>> {
  if (!downloadImageWorker) {
    downloadImageWorker = new Piscina({
      filename: join(__dirname, 'workers', 'image-downloader.js'),
      concurrentTasksPerWorker: WORKER_THREADS.DOWNLOAD_IMAGE.CONCURRENCY,
      maxThreads: WORKER_THREADS.DOWNLOAD_IMAGE.MAX_THREADS
    })
  }

  return downloadImageWorker.run(options)
}

// ---------------------------------------------------------------------------

let processImageWorker: Piscina

function processImageFromWorker (options: Parameters<typeof processImage>[0]): Promise<ReturnType<typeof processImage>> {
  if (!processImageWorker) {
    processImageWorker = new Piscina({
      filename: join(__dirname, 'workers', 'image-processor.js'),
      concurrentTasksPerWorker: WORKER_THREADS.PROCESS_IMAGE.CONCURRENCY,
      maxThreads: WORKER_THREADS.PROCESS_IMAGE.MAX_THREADS
    })
  }

  return processImageWorker.run(options)
}

// ---------------------------------------------------------------------------

let parallelHTTPBroadcastWorker: Piscina

function parallelHTTPBroadcastFromWorker (options: Parameters<typeof httpBroadcast>[0]): Promise<ReturnType<typeof httpBroadcast>> {
  if (!parallelHTTPBroadcastWorker) {
    parallelHTTPBroadcastWorker = new Piscina({
      filename: join(__dirname, 'workers', 'http-broadcast.js'),
      concurrentTasksPerWorker: WORKER_THREADS.PARALLEL_HTTP_BROADCAST.CONCURRENCY,
      maxThreads: WORKER_THREADS.PARALLEL_HTTP_BROADCAST.MAX_THREADS
    })
  }

  return parallelHTTPBroadcastWorker.run(options)
}

// ---------------------------------------------------------------------------

let sequentialHTTPBroadcastWorker: Piscina

function sequentialHTTPBroadcastFromWorker (options: Parameters<typeof httpBroadcast>[0]): Promise<ReturnType<typeof httpBroadcast>> {
  if (!sequentialHTTPBroadcastWorker) {
    sequentialHTTPBroadcastWorker = new Piscina({
      filename: join(__dirname, 'workers', 'http-broadcast.js'),
      concurrentTasksPerWorker: WORKER_THREADS.SEQUENTIAL_HTTP_BROADCAST.CONCURRENCY,
      maxThreads: WORKER_THREADS.SEQUENTIAL_HTTP_BROADCAST.MAX_THREADS
    })
  }

  return sequentialHTTPBroadcastWorker.run(options)
}

export {
  downloadImageFromWorker,
  processImageFromWorker,
  parallelHTTPBroadcastFromWorker,
  sequentialHTTPBroadcastFromWorker
}
