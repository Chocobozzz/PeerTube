import * as asyncLRU from 'async-lru'
import { createWriteStream } from 'fs'
import { join } from 'path'
import { logger, unlinkPromise } from '../../helpers'
import { CACHE, CONFIG } from '../../initializers'
import { VideoModel } from '../../models/video/video'
import { fetchRemoteVideoPreview } from '../activitypub'

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

  async getPreviewPath (key: string) {
    const video = await VideoModel.loadByUUID(key)
    if (!video) return undefined

    if (video.isOwned()) return join(CONFIG.STORAGE.PREVIEWS_DIR, video.getPreviewName())

    return new Promise<string>((res, rej) => {
      this.lru.get(key, (err, value) => {
        err ? rej(err) : res(value)
      })
    })
  }

  private async loadPreviews (key: string) {
    const video = await VideoModel.loadByUUIDAndPopulateAccountAndServerAndTags(key)
    if (!video) return undefined

    if (video.isOwned()) throw new Error('Cannot load preview of owned video.')

    return this.saveRemotePreviewAndReturnPath(video)
  }

  private saveRemotePreviewAndReturnPath (video: VideoModel) {
    return new Promise<string>((res, rej) => {
      const req = fetchRemoteVideoPreview(video, rej)
      const path = join(CACHE.DIRECTORIES.PREVIEWS, video.getPreviewName())
      const stream = createWriteStream(path)

      req.pipe(stream)
        .on('error', (err) => rej(err))
        .on('finish', () => res(path))
    })
  }
}

export {
  VideosPreviewCache
}
