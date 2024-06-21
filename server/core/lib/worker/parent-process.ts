import { join } from 'path'
import { Piscina } from 'piscina'
import { JOB_CONCURRENCY, WORKER_THREADS } from '@server/initializers/constants.js'
import type httpBroadcast from './workers/http-broadcast.js'
import type downloadImage from './workers/image-downloader.js'
import type processImage from './workers/image-processor.js'
import type getImageSize from './workers/get-image-size.js'
import type signJsonLDObject from './workers/sign-json-ld-object.js'
import type buildDigest from './workers/build-digest.js'
import type httpUnicast from './workers/http-unicast.js'
import { logger } from '@server/helpers/logger.js'

let downloadImageWorker: Piscina

export function downloadImageFromWorker (options: Parameters<typeof downloadImage>[0]): Promise<ReturnType<typeof downloadImage>> {
  if (!downloadImageWorker) {
    downloadImageWorker = new Piscina({
      filename: new URL(join('workers', 'image-downloader.js'), import.meta.url).href,
      concurrentTasksPerWorker: WORKER_THREADS.DOWNLOAD_IMAGE.CONCURRENCY,
      maxThreads: WORKER_THREADS.DOWNLOAD_IMAGE.MAX_THREADS,
      minThreads: 1
    })

    downloadImageWorker.on('error', err => logger.error('Error in download image worker', { err }))
  }

  return downloadImageWorker.run(options)
}

// ---------------------------------------------------------------------------

let processImageWorker: Piscina

export function processImageFromWorker (options: Parameters<typeof processImage>[0]): Promise<ReturnType<typeof processImage>> {
  if (!processImageWorker) {
    processImageWorker = new Piscina({
      filename: new URL(join('workers', 'image-processor.js'), import.meta.url).href,
      concurrentTasksPerWorker: WORKER_THREADS.PROCESS_IMAGE.CONCURRENCY,
      maxThreads: WORKER_THREADS.PROCESS_IMAGE.MAX_THREADS,
      minThreads: 1
    })

    processImageWorker.on('error', err => logger.error('Error in process image worker', { err }))
  }

  return processImageWorker.run(options)
}

// ---------------------------------------------------------------------------

let getImageSizeWorker: Piscina

export function getImageSizeFromWorker (options: Parameters<typeof getImageSize>[0]): Promise<ReturnType<typeof getImageSize>> {
  if (!getImageSizeWorker) {
    getImageSizeWorker = new Piscina({
      filename: new URL(join('workers', 'get-image-size.js'), import.meta.url).href,
      concurrentTasksPerWorker: WORKER_THREADS.GET_IMAGE_SIZE.CONCURRENCY,
      maxThreads: WORKER_THREADS.GET_IMAGE_SIZE.MAX_THREADS,
      minThreads: 1
    })

    getImageSizeWorker.on('error', err => logger.error('Error in get image size worker', { err }))
  }

  return getImageSizeWorker.run(options)
}

// ---------------------------------------------------------------------------

let parallelHTTPBroadcastWorker: Piscina

export function parallelHTTPBroadcastFromWorker (options: Parameters<typeof httpBroadcast>[0]): Promise<ReturnType<typeof httpBroadcast>> {
  if (!parallelHTTPBroadcastWorker) {
    parallelHTTPBroadcastWorker = new Piscina({
      filename: new URL(join('workers', 'http-broadcast.js'), import.meta.url).href,
      // Keep it sync with job concurrency so the worker will accept all the requests sent by the parallelized jobs
      concurrentTasksPerWorker: JOB_CONCURRENCY['activitypub-http-broadcast-parallel'],
      maxThreads: 1,
      minThreads: 1
    })

    parallelHTTPBroadcastWorker.on('error', err => logger.error('Error in parallel HTTP broadcast worker', { err }))
  }

  return parallelHTTPBroadcastWorker.run(options)
}

// ---------------------------------------------------------------------------

let sequentialHTTPBroadcastWorker: Piscina

export function sequentialHTTPBroadcastFromWorker (
  options: Parameters<typeof httpBroadcast>[0]
): Promise<ReturnType<typeof httpBroadcast>> {
  if (!sequentialHTTPBroadcastWorker) {
    sequentialHTTPBroadcastWorker = new Piscina({
      filename: new URL(join('workers', 'http-broadcast.js'), import.meta.url).href,
      // Keep it sync with job concurrency so the worker will accept all the requests sent by the parallelized jobs
      concurrentTasksPerWorker: JOB_CONCURRENCY['activitypub-http-broadcast'],
      maxThreads: 1,
      minThreads: 1
    })

    sequentialHTTPBroadcastWorker.on('error', err => logger.error('Error in sequential HTTP broadcast image worker', { err }))
  }

  return sequentialHTTPBroadcastWorker.run(options)
}

// ---------------------------------------------------------------------------

let httpUnicastWorker: Piscina

export function httpUnicastFromWorker (
  options: Parameters<typeof httpUnicast>[0]
): Promise<ReturnType<typeof httpUnicast>> {
  if (!httpUnicastWorker) {
    httpUnicastWorker = new Piscina({
      filename: new URL(join('workers', 'http-unicast.js'), import.meta.url).href,
      // Keep it sync with job concurrency so the worker will accept all the requests sent by the parallelized jobs
      concurrentTasksPerWorker: JOB_CONCURRENCY['activitypub-http-unicast'],
      maxThreads: 1,
      minThreads: 1
    })

    httpUnicastWorker.on('error', err => logger.error('Error in HTTP unicast worker', { err }))
  }

  return httpUnicastWorker.run(options)
}

// ---------------------------------------------------------------------------

let signJsonLDObjectWorker: Piscina

export function signJsonLDObjectFromWorker <T> (
  options: Parameters<typeof signJsonLDObject<T>>[0]
): ReturnType<typeof signJsonLDObject<T>> {
  if (!signJsonLDObjectWorker) {
    signJsonLDObjectWorker = new Piscina({
      filename: new URL(join('workers', 'sign-json-ld-object.js'), import.meta.url).href,
      concurrentTasksPerWorker: WORKER_THREADS.SIGN_JSON_LD_OBJECT.CONCURRENCY,
      maxThreads: WORKER_THREADS.SIGN_JSON_LD_OBJECT.MAX_THREADS,
      minThreads: 1
    })

    signJsonLDObjectWorker.on('error', err => logger.error('Error in sign JSONLD object worker', { err }))
  }

  return signJsonLDObjectWorker.run(options)
}

// ---------------------------------------------------------------------------

let buildDigestWorker: Piscina

export function buildDigestFromWorker (
  options: Parameters<typeof buildDigest>[0]
): Promise<ReturnType<typeof buildDigest>> {
  if (!buildDigestWorker) {
    buildDigestWorker = new Piscina({
      filename: new URL(join('workers', 'build-digest.js'), import.meta.url).href,
      // Keep it sync with job concurrency so the worker will accept all the requests sent by the parallelized jobs
      concurrentTasksPerWorker: WORKER_THREADS.BUILD_DIGEST.CONCURRENCY,
      maxThreads: WORKER_THREADS.BUILD_DIGEST.MAX_THREADS,
      minThreads: 1
    })

    buildDigestWorker.on('error', err => logger.error('Error in build digest worker', { err }))
  }

  return buildDigestWorker.run(options)
}

// ---------------------------------------------------------------------------

export function getWorkersStats () {
  return [
    {
      label: 'downloadImage',
      queueSize: downloadImageWorker?.queueSize || 0,
      completed: downloadImageWorker?.completed || 0
    },
    {
      label: 'processImageWorker',
      queueSize: processImageWorker?.queueSize || 0,
      completed: processImageWorker?.completed || 0
    },
    {
      label: 'getImageSizeWorker',
      queueSize: getImageSizeWorker?.queueSize || 0,
      completed: getImageSizeWorker?.completed || 0
    },
    {
      label: 'parallelHTTPBroadcastWorker',
      queueSize: parallelHTTPBroadcastWorker?.queueSize || 0,
      completed: parallelHTTPBroadcastWorker?.completed || 0
    },
    {
      label: 'sequentialHTTPBroadcastWorker',
      queueSize: sequentialHTTPBroadcastWorker?.queueSize || 0,
      completed: sequentialHTTPBroadcastWorker?.completed || 0
    },
    {
      label: 'httpUnicastWorker',
      queueSize: httpUnicastWorker?.queueSize || 0,
      completed: httpUnicastWorker?.completed || 0
    },
    {
      label: 'signJsonLDObjectWorker',
      queueSize: signJsonLDObjectWorker?.queueSize || 0,
      completed: signJsonLDObjectWorker?.completed || 0
    },
    {
      label: 'buildDigestWorker',
      queueSize: buildDigestWorker?.queueSize || 0,
      completed: buildDigestWorker?.completed || 0
    }
  ]
}
