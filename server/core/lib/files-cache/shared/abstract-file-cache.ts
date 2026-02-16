import { HttpStatusCode } from '@peertube/peertube-models'
import { logger } from '@server/helpers/logger.js'
import { CachePromise } from '@server/helpers/promise-cache.js'
import { doRequestAndSaveToFile } from '@server/helpers/requests.js'
import { LRU_CACHE, STATIC_MAX_AGE } from '@server/initializers/constants.js'
import express from 'express'
import { LRUCache } from 'lru-cache'
import { Model } from 'sequelize'

export type FileModel = {
  fileUrl: string
  filename: string
  cached: boolean

  isLocal(): boolean

  save(): Promise<Model>
}

export abstract class AbstractFileCache<M extends FileModel> {
  private readonly filenameToPathCache = new LRUCache<string, string>({
    max: LRU_CACHE.FILENAME_TO_PATH_PERMANENT_FILE_CACHE.MAX_SIZE
  })

  protected abstract loadModel (filename: string): Promise<M>
  protected abstract getFSFilePath (model: M): string
  protected abstract getFSFileCachedPath (model: M): string

  async lazyServe (options: {
    filename: string
    res: express.Response
    next: express.NextFunction
  }) {
    const { filename, res, next } = options

    if (this.filenameToPathCache.has(filename)) {
      return res.sendFile(this.filenameToPathCache.get(filename), { maxAge: STATIC_MAX_AGE.SERVER })
    }

    const file = await this.lazyLoadIfNeeded(filename)
    if (!file) return res.status(HttpStatusCode.NOT_FOUND_404).end()

    const path = file.isLocal()
      ? this.getFSFilePath(file)
      : this.getFSFileCachedPath(file)

    this.filenameToPathCache.set(filename, path)

    return res.sendFile(path, { maxAge: STATIC_MAX_AGE.LAZY_SERVER }, (err: any) => {
      if (!err) return

      this.onServeError({ err, file, next, filename })
    })
  }

  @CachePromise({
    keyBuilder: filename => filename
  })
  private async lazyLoadIfNeeded (filename: string) {
    const file = await this.loadModel(filename)
    if (!file) return undefined

    if (!file.isLocal() && file.cached === false) {
      if (!file.fileUrl) return undefined

      try {
        await this.downloadRemoteFile(file)
      } catch (err) {
        logger.warn('Cannot process remote image %s.', file.fileUrl, { err })

        return undefined
      }
    }

    return file
  }

  async downloadRemoteFile (file: M) {
    logger.info('Download remote file %s lazily.', file.fileUrl)

    const destination = await this.downloadImpl(file)

    file.cached = true
    file.save()
      .catch(err => logger.error('Cannot save new image disk state.', { err }))

    return destination
  }

  protected async downloadImpl (file: M) {
    const destPath = this.getFSFileCachedPath(file)

    await doRequestAndSaveToFile(file.fileUrl, destPath)

    return destPath
  }

  private onServeError (options: {
    err: any
    file: M
    filename: string
    next: express.NextFunction
  }) {
    const { err, file, filename, next } = options

    // It seems this actor image is not on the disk anymore
    if (err.status === HttpStatusCode.NOT_FOUND_404 && !file.isLocal()) {
      logger.error('Cannot lazy serve image %s.', filename, { err })

      this.filenameToPathCache.delete(filename)

      file.cached = false
      file.save()
        .catch(err => logger.error('Cannot save new file disk state.', { err }))
    }

    return next(err)
  }
}
