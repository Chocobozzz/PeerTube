import express from 'express'
import { LRUCache } from 'lru-cache'
import { logger } from '@server/helpers/logger'
import { LRU_CACHE, STATIC_MAX_AGE } from '@server/initializers/constants'
import { downloadImageFromWorker } from '@server/lib/worker/parent-process'
import { HttpStatusCode } from '@shared/models'
import { Model } from 'sequelize'

type ImageModel = {
  fileUrl: string
  filename: string
  onDisk: boolean

  isOwned (): boolean
  getPath (): string

  save (): Promise<Model>
}

export abstract class AbstractPermanentFileCache <M extends ImageModel> {
  // Unsafe because it can return paths that do not exist anymore
  private readonly filenameToPathUnsafeCache = new LRUCache<string, string>({
    max: LRU_CACHE.FILENAME_TO_PATH_PERMANENT_FILE_CACHE.MAX_SIZE
  })

  protected abstract getImageSize (image: M): { width: number, height: number }
  protected abstract loadModel (filename: string): Promise<M>

  constructor (private readonly directory: string) {

  }

  async lazyServe (options: {
    filename: string
    res: express.Response
    next: express.NextFunction
  }) {
    const { filename, res, next } = options

    if (this.filenameToPathUnsafeCache.has(filename)) {
      return res.sendFile(this.filenameToPathUnsafeCache.get(filename), { maxAge: STATIC_MAX_AGE.SERVER })
    }

    const image = await this.loadModel(filename)
    if (!image) return res.status(HttpStatusCode.NOT_FOUND_404).end()

    if (image.onDisk === false) {
      if (!image.fileUrl) return res.status(HttpStatusCode.NOT_FOUND_404).end()

      try {
        await this.downloadRemoteFile(image)
      } catch (err) {
        logger.warn('Cannot process remote image %s.', image.fileUrl, { err })

        return res.status(HttpStatusCode.NOT_FOUND_404).end()
      }
    }

    const path = image.getPath()
    this.filenameToPathUnsafeCache.set(filename, path)

    return res.sendFile(path, { maxAge: STATIC_MAX_AGE.LAZY_SERVER }, (err: any) => {
      if (!err) return

      this.onServeError({ err, image, next, filename })
    })
  }

  async downloadRemoteFile (image: M) {
    logger.info('Download remote image %s lazily.', image.fileUrl)

    const destination = await this.downloadImage({
      filename: image.filename,
      fileUrl: image.fileUrl,
      size: this.getImageSize(image)
    })

    image.onDisk = true
    image.save()
      .catch(err => logger.error('Cannot save new image disk state.', { err }))

    return destination
  }

  private onServeError (options: {
    err: any
    image: M
    filename: string
    next: express.NextFunction
  }) {
    const { err, image, filename, next } = options

    // It seems this actor image is not on the disk anymore
    if (err.status === HttpStatusCode.NOT_FOUND_404 && !image.isOwned()) {
      logger.error('Cannot lazy serve image %s.', filename, { err })

      this.filenameToPathUnsafeCache.delete(filename)

      image.onDisk = false
      image.save()
        .catch(err => logger.error('Cannot save new image disk state.', { err }))
    }

    return next(err)
  }

  private downloadImage (options: {
    fileUrl: string
    filename: string
    size: { width: number, height: number }
  }) {
    const downloaderOptions = {
      url: options.fileUrl,
      destDir: this.directory,
      destName: options.filename,
      size: options.size
    }

    return downloadImageFromWorker(downloaderOptions)
  }
}
