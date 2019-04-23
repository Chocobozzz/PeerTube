import { createWriteStream, remove } from 'fs-extra'
import { logger } from '../../helpers/logger'
import { VideoModel } from '../../models/video/video'
import { fetchRemoteVideoStaticFile } from '../activitypub'
import * as memoizee from 'memoizee'

type GetFilePathResult = { isOwned: boolean, path: string } | undefined

export abstract class AbstractVideoStaticFileCache <T> {

  getFilePath: (params: T) => Promise<GetFilePathResult>

  abstract getFilePathImpl (params: T): Promise<GetFilePathResult>

  // Load and save the remote file, then return the local path from filesystem
  protected abstract loadRemoteFile (key: string): Promise<GetFilePathResult>

  init (max: number, maxAge: number) {
    this.getFilePath = memoizee(this.getFilePathImpl, {
      maxAge,
      max,
      promise: true,
      dispose: (result: GetFilePathResult) => {
        if (result.isOwned !== true) {
          remove(result.path)
            .then(() => logger.debug('%s removed from %s', result.path, this.constructor.name))
            .catch(err => logger.error('Cannot remove %s from cache %s.', result.path, this.constructor.name, { err }))
        }
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
