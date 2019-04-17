import { createWriteStream, remove } from 'fs-extra'
import { logger } from '../../helpers/logger'
import { VideoModel } from '../../models/video/video'
import { fetchRemoteVideoStaticFile } from '../activitypub'
import * as memoizee from 'memoizee'

export abstract class AbstractVideoStaticFileCache <T> {

  getFilePath: (params: T) => Promise<string>

  abstract getFilePathImpl (params: T): Promise<string>

  // Load and save the remote file, then return the local path from filesystem
  protected abstract loadRemoteFile (key: string): Promise<string>

  init (max: number, maxAge: number) {
    this.getFilePath = memoizee(this.getFilePathImpl, {
      maxAge,
      max,
      promise: true,
      dispose: (value: string) => {
        remove(value)
          .then(() => logger.debug('%s evicted from %s', value, this.constructor.name))
          .catch(err => logger.error('Cannot remove %s from cache %s.', value, this.constructor.name, { err }))
      }
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
