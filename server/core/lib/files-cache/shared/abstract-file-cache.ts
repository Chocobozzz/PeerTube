import { FileStorage, FileStorageType, HttpStatusCode } from '@peertube/peertube-models'
import { buildUUID, parseDurationToMs } from '@peertube/peertube-node-utils'
import { createLogger } from '@server/helpers/logger.js'
import { CachePromise } from '@server/helpers/promise-cache.js'
import { getRemoteErrorLogLevel } from '@server/helpers/remote-errors.js'
import { doRequestAndSaveToFile, PeerTubeRequestError } from '@server/helpers/requests.js'
import { CONFIG } from '@server/initializers/config.js'
import { LRU_CACHE, STATIC_MAX_AGE } from '@server/initializers/constants.js'
import { buildCachedObjectUrl, cachedObjectExists, FilesCacheType, storeCachedObject } from '@server/lib/object-storage/cache.js'
import express from 'express'
import { remove } from 'fs-extra/esm'
import { LRUCache } from 'lru-cache'
import { extname, join } from 'path'
import { Model } from 'sequelize'

const logger = createLogger()

export type FileModel = {
  fileUrl: string
  filename: string
  cached: boolean

  // Local files: where the file is stored
  // Remote files: where the cached copy is stored, if any
  storage: FileStorageType

  isLocal(): boolean
  getLocalFileUrl(): string

  save(): Promise<Model>
}

// Where a file is: a path on the file system of this process, or a public object of the cache bucket
type FileLocation = { storage: typeof FileStorage.FILE_SYSTEM, path: string } | { storage: typeof FileStorage.OBJECT_STORAGE }

export abstract class AbstractFileCache<M extends FileModel> {
  private readonly filenameToLocationCache = new LRUCache<string, FileLocation>({
    max: LRU_CACHE.FILENAME_TO_PATH_PERMANENT_FILE_CACHE.MAX_SIZE
  })

  protected abstract readonly cacheType: FilesCacheType

  protected abstract loadModel (filename: string): Promise<M>
  protected abstract getFSFilePath (model: M): string
  protected abstract getFSFileCachedPath (model: M): string
  protected abstract onLazyFetchNotFound (model: M): any

  async lazyServe (options: {
    filename: string
    res: express.Response
    next: express.NextFunction

    // Download a remote file again if its cached copy has been removed (default true)
    downloadAgainIfMissing?: boolean
  }) {
    const { filename, res, next, downloadAgainIfMissing = true } = options

    const cachedLocation = this.filenameToLocationCache.get(filename)
    if (cachedLocation) {
      return this.serveLocation({
        filename,
        location: cachedLocation,
        res,
        next,

        // The file may have been moved or removed since we cached its location: serve it again without the cache
        onNotFound: () => {
          this.filenameToLocationCache.delete(filename)

          return this.lazyServe({ filename, res, next, downloadAgainIfMissing })
        }
      })
    }

    const file = await this.lazyLoadIfNeeded(filename)
    if (!file) return res.status(HttpStatusCode.NOT_FOUND_404).end()

    // Keep compatibility for URLs published before they were moved
    if (file.isLocal() && file.storage === FileStorage.OBJECT_STORAGE) {
      return res.redirect(HttpStatusCode.FOUND_302, file.getLocalFileUrl())
    }

    const location: FileLocation = file.isLocal()
      ? { storage: FileStorage.FILE_SYSTEM, path: this.getFSFilePath(file) }
      : this.getCachedCopyLocation(file)

    const onNotFound = () => this.onFileNotFound({ file, filename, res, next, downloadAgainIfMissing })

    if (location.storage === FileStorage.OBJECT_STORAGE) {
      if (!this.filenameToLocationCache.has(filename)) {
        const exists = await this.checkCachedObjectExists(filename)
        if (exists === false) return onNotFound()

        // Unknown: check it again next time
        if (exists === true) this.filenameToLocationCache.set(filename, location)
      }
    } else {
      this.filenameToLocationCache.set(filename, location)
    }

    return this.serveLocation({
      filename,
      location,
      res,
      next,
      onNotFound
    })
  }

  private async checkCachedObjectExists (filename: string) {
    try {
      return await cachedObjectExists(this.cacheType, filename)
    } catch (err) {
      logger.warn('Cannot check whether cached copy %s exists in object storage.', filename, { err })

      return undefined
    }
  }

  @CachePromise({
    keyBuilder: filename => filename
  })
  private async lazyLoadIfNeeded (filename: string) {
    const file = await this.loadModel(filename)
    if (!file) return undefined

    if (!file.isLocal() && !this.hasUsableCachedCopy(file)) {
      if (!file.fileUrl) return undefined

      try {
        await this.downloadRemoteFile(file)
      } catch (err) {
        if ((err as PeerTubeRequestError).statusCode === HttpStatusCode.NOT_FOUND_404) {
          this.onLazyFetchNotFound(file)
        } else {
          logger.log(getRemoteErrorLogLevel(err), 'Cannot process remote file %s.', file.fileUrl, { err })
        }

        return undefined
      }
    }

    return file
  }

  private hasUsableCachedCopy (file: M) {
    return file.cached === true && file.storage === this.getTargetStorage()
  }

  private async downloadRemoteFile (file: M) {
    logger.info('Download remote file %s lazily.', file.fileUrl)

    const storage = this.getTargetStorage()

    if (storage === FileStorage.OBJECT_STORAGE) {
      const tmpPath = join(CONFIG.STORAGE.TMP_DIR, buildUUID() + extname(file.filename))

      try {
        await this.downloadImpl(file, tmpPath)
        await storeCachedObject(this.cacheType, tmpPath, file.filename)
      } finally {
        await remove(tmpPath)
      }

      // We know it exists: no need to check it before redirecting to it
      this.filenameToLocationCache.set(file.filename, { storage: FileStorage.OBJECT_STORAGE })
    } else {
      await this.downloadImpl(file, this.getFSFileCachedPath(file))
    }

    file.cached = true
    file.storage = storage
    file.save()
      .catch(err => logger.error('Cannot save new cached file state.', { err }))
  }

  protected async downloadImpl (file: M, destPath: string) {
    await doRequestAndSaveToFile(file.fileUrl, destPath)
  }

  // ---------------------------------------------------------------------------

  private serveLocation (options: {
    filename: string
    location: FileLocation
    res: express.Response
    next: express.NextFunction
    onNotFound: () => unknown
  }) {
    const { filename, location, res, next, onNotFound } = options

    if (location.storage === FileStorage.OBJECT_STORAGE) {
      return this.redirectToCachedObject(filename, res)
    }

    return res.sendFile(location.path, { maxAge: STATIC_MAX_AGE.LAZY_SERVER }, (err: any) => {
      if (!err || this.isClientAbortError(err)) return

      if (err.status === HttpStatusCode.NOT_FOUND_404 && !res.headersSent) {
        return Promise.resolve(onNotFound())
          .catch(err => next(err))
      }

      return next(err)
    })
  }

  private redirectToCachedObject (filename: string, res: express.Response) {
    res.setHeader('Cache-Control', 'public, max-age=' + Math.floor(parseDurationToMs(STATIC_MAX_AGE.LAZY_SERVER_REDIRECT) / 1000))

    return res.redirect(HttpStatusCode.FOUND_302, buildCachedObjectUrl(this.cacheType, filename))
  }

  // The cached copy of a remote file on the file system can be removed at any time (cache directory purged...): download it again
  private async onFileNotFound (options: {
    file: M
    filename: string
    res: express.Response
    next: express.NextFunction
    downloadAgainIfMissing: boolean
  }) {
    const { file, filename, res, next, downloadAgainIfMissing } = options

    this.filenameToLocationCache.delete(filename)

    if (file.isLocal()) return res.status(HttpStatusCode.NOT_FOUND_404).end()

    logger.warn('Cached copy of remote file %s not found.', filename)

    // Saved before serving it again, that reloads the file from the database
    file.cached = false
    await file.save()

    // Only once: the remote file may be downloaded but not stored
    if (!downloadAgainIfMissing) return res.status(HttpStatusCode.NOT_FOUND_404).end()

    return this.lazyServe({ filename, res, next, downloadAgainIfMissing: false })
  }

  private getCachedCopyLocation (file: M): FileLocation {
    if (file.storage === FileStorage.OBJECT_STORAGE) return { storage: FileStorage.OBJECT_STORAGE }

    return { storage: FileStorage.FILE_SYSTEM, path: this.getFSFileCachedPath(file) }
  }

  private getTargetStorage () {
    return CONFIG.OBJECT_STORAGE.ENABLED
      ? FileStorage.OBJECT_STORAGE
      : FileStorage.FILE_SYSTEM
  }

  // Express ignores these errors when sendFile has no callback: the client went away, there is nothing to answer
  private isClientAbortError (err: any) {
    return err.code === 'ECONNABORTED' || err.syscall === 'write'
  }
}
