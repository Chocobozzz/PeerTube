import * as asyncLRU from 'async-lru'
import { join } from 'path'
import { createWriteStream } from 'fs'
import * as Promise from 'bluebird'

import { database as db, CONFIG, CACHE } from '../../initializers'
import { logger, unlinkPromise } from '../../helpers'
import { VideoInstance } from '../../models'
import { fetchRemotePreview } from '../../lib'

class VideosPreviewCache {

  private static instance: VideosPreviewCache

  private lru

  private constructor () { }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }

  init (max: number) {
    this.lru = new asyncLRU({
      max,
      load: (key, cb) => {
        this.loadPreviews(key)
          .then(res => cb(null, res))
          .catch(err => cb(err))
      }
    })

    this.lru.on('evict', (obj: { key: string, value: string }) => {
      unlinkPromise(obj.value).then(() => logger.debug('%s evicted from VideosPreviewCache', obj.value))
    })
  }

  getPreviewPath (key: string) {
    return new Promise<string>((res, rej) => {
      this.lru.get(key, (err, value) => {
        err ? rej(err) : res(value)
      })
    })
  }

  private loadPreviews (key: string) {
    return db.Video.loadByUUIDAndPopulateAuthorAndPodAndTags(key)
      .then(video => {
        if (!video) return undefined

        if (video.isOwned()) return join(CONFIG.STORAGE.PREVIEWS_DIR, video.getPreviewName())

        return this.saveRemotePreviewAndReturnPath(video)
      })
  }

  private saveRemotePreviewAndReturnPath (video: VideoInstance) {
    const req = fetchRemotePreview(video.Author.Pod, video)

    return new Promise<string>((res, rej) => {
      const path = join(CACHE.DIRECTORIES.PREVIEWS, video.getPreviewName())
      const stream = createWriteStream(path)

      req.pipe(stream)
         .on('finish', () => res(path))
         .on('error', (err) => rej(err))
    })
  }
}

export {
  VideosPreviewCache
}
