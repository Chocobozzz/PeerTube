import * as AsyncLRU from 'async-lru'
import { createWriteStream } from 'fs'
import { unlinkPromise } from '../../helpers/core-utils'
import { logger } from '../../helpers/logger'
import { VideoModel } from '../../models/video/video'
import { fetchRemoteVideoStaticFile } from '../activitypub'

export abstract class AbstractVideoStaticFileCache <T> {

  protected lru

  abstract getFilePath (params: T): Promise<string>

  // Load and save the remote file, then return the local path from filesystem
  protected abstract loadRemoteFile (key: string): Promise<string>

  init (max: number, maxAge: number) {
    this.lru = new AsyncLRU({
      max,
      maxAge,
      load: (key, cb) => {
        this.loadRemoteFile(key)
          .then(res => cb(null, res))
          .catch(err => cb(err))
      }
    })

    this.lru.on('evict', (obj: { key: string, value: string }) => {
      unlinkPromise(obj.value)
        .then(() => logger.debug('%s evicted from %s', obj.value, this.constructor.name))
    })
  }

  protected loadFromLRU (key: string) {
    return new Promise<string>((res, rej) => {
      this.lru.get(key, (err, value) => {
        err ? rej(err) : res(value)
      })
    })
  }

  protected saveRemoteVideoFileAndReturnPath (video: VideoModel, remoteStaticPath: string, destPath: string) {
    return new Promise<string>((res, rej) => {
      const req = fetchRemoteVideoStaticFile(video, remoteStaticPath, rej)

      const stream = createWriteStream(destPath)

      req.pipe(stream)
         .on('error', (err) => rej(err))
         .on('finish', () => res(destPath))
    })
  }
}
