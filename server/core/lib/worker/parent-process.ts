import { join } from 'path'
import Piscina from 'piscina'
import { JOB_CONCURRENCY, WORKER_THREADS } from '@server/initializers/constants.js'
import type httpBroadcast from './workers/http-broadcast.js'
import type downloadImage from './workers/image-downloader.js'
import type processImage from './workers/image-processor.js'
import type getImageSize from './workers/get-image-size.js'

let downloadImageWorker: Piscina

function downloadImageFromWorker (options: Parameters<typeof downloadImage>[0]): Promise<ReturnType<typeof downloadImage>> {
  if (!downloadImageWorker) {
    downloadImageWorker = new Piscina({
      filename: new URL(join('workers', 'image-downloader.js'), import.meta.url).href,
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
      filename: new URL(join('workers', 'image-processor.js'), import.meta.url).href,
      concurrentTasksPerWorker: WORKER_THREADS.PROCESS_IMAGE.CONCURRENCY,
      maxThreads: WORKER_THREADS.PROCESS_IMAGE.MAX_THREADS
    })
  }

  return processImageWorker.run(options)
}

// ---------------------------------------------------------------------------

let getImageSizeWorker: Piscina

function getImageSizeFromWorker (options: Parameters<typeof getImageSize>[0]): Promise<ReturnType<typeof getImageSize>> {
  if (!getImageSizeWorker) {
    getImageSizeWorker = new Piscina({
      filename: new URL(join('workers', 'get-image-size.js'), import.meta.url).href,
      concurrentTasksPerWorker: WORKER_THREADS.GET_IMAGE_SIZE.CONCURRENCY,
      maxThreads: WORKER_THREADS.GET_IMAGE_SIZE.MAX_THREADS
    })
  }

  return getImageSizeWorker.run(options)
}

// ---------------------------------------------------------------------------

let parallelHTTPBroadcastWorker: Piscina

function parallelHTTPBroadcastFromWorker (options: Parameters<typeof httpBroadcast>[0]): Promise<ReturnType<typeof httpBroadcast>> {
  if (!parallelHTTPBroadcastWorker) {
    parallelHTTPBroadcastWorker = new Piscina({
      filename: new URL(join('workers', 'http-broadcast.js'), import.meta.url).href,
      // Keep it sync with job concurrency so the worker will accept all the requests sent by the parallelized jobs
      concurrentTasksPerWorker: JOB_CONCURRENCY['activitypub-http-broadcast-parallel'],
      maxThreads: 1
    })
  }

  return parallelHTTPBroadcastWorker.run(options)
}

// ---------------------------------------------------------------------------

let sequentialHTTPBroadcastWorker: Piscina

function sequentialHTTPBroadcastFromWorker (options: Parameters<typeof httpBroadcast>[0]): Promise<ReturnType<typeof httpBroadcast>> {
  if (!sequentialHTTPBroadcastWorker) {
    sequentialHTTPBroadcastWorker = new Piscina({
      filename: new URL(join('workers', 'http-broadcast.js'), import.meta.url).href,
      // Keep it sync with job concurrency so the worker will accept all the requests sent by the parallelized jobs
      concurrentTasksPerWorker: JOB_CONCURRENCY['activitypub-http-broadcast'],
      maxThreads: 1
    })
  }

  return sequentialHTTPBroadcastWorker.run(options)
}

export {
  downloadImageFromWorker,
  processImageFromWorker,
  parallelHTTPBroadcastFromWorker,
  getImageSizeFromWorker,
  sequentialHTTPBroadcastFromWorker
}
