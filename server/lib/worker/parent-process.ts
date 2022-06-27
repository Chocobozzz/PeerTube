import { join } from 'path'
import Piscina from 'piscina'
import { WORKER_THREADS } from '@server/initializers/constants'
import { downloadImage } from './workers/image-downloader'
import { processImage } from '@server/helpers/image-utils'

const downloadImagerWorker = new Piscina({
  filename: join(__dirname, 'workers', 'image-downloader.js'),
  concurrentTasksPerWorker: WORKER_THREADS.DOWNLOAD_IMAGE.CONCURRENCY,
  maxThreads: WORKER_THREADS.DOWNLOAD_IMAGE.MAX_THREADS
})

function downloadImageFromWorker (options: Parameters<typeof downloadImage>[0]): Promise<ReturnType<typeof downloadImage>> {
  return downloadImagerWorker.run(options)
}

// ---------------------------------------------------------------------------

const processImageWorker = new Piscina({
  filename: join(__dirname, 'workers', 'image-processor.js'),
  concurrentTasksPerWorker: WORKER_THREADS.DOWNLOAD_IMAGE.CONCURRENCY,
  maxThreads: WORKER_THREADS.DOWNLOAD_IMAGE.MAX_THREADS
})

function processImageFromWorker (options: Parameters<typeof processImage>[0]): Promise<ReturnType<typeof processImage>> {
  return processImageWorker.run(options)
}

export {
  downloadImageFromWorker,
  processImageFromWorker
}
