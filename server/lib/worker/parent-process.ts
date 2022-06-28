import { join } from 'path'
import Piscina from 'piscina'
import { processImage } from '@server/helpers/image-utils'
import { WORKER_THREADS } from '@server/initializers/constants'
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

export {
  downloadImageFromWorker,
  processImageFromWorker
}
