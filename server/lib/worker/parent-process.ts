import { join } from 'path'
import Piscina from 'piscina'
import { WORKER_THREADS } from '@server/initializers/constants'
import { downloadImage } from './workers/image-downloader'

const downloadImagerWorker = new Piscina({
  filename: join(__dirname, 'workers', 'image-downloader.js'),
  concurrentTasksPerWorker: WORKER_THREADS.DOWNLOAD_IMAGE.CONCURRENCY,
  maxThreads: WORKER_THREADS.DOWNLOAD_IMAGE.MAX_THREADS
})

function downloadImageFromWorker (options: Parameters<typeof downloadImage>[0]): Promise<ReturnType<typeof downloadImage>> {
  return downloadImagerWorker.run(options)
}

export {
  downloadImageFromWorker
}
