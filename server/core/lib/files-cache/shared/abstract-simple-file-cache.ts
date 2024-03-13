import { remove } from 'fs-extra/esm'
import { logger } from '../../../helpers/logger.js'
import memoizee from 'memoizee'

type GetFilePathResult = { isOwned: boolean, path: string, downloadName?: string } | undefined

export abstract class AbstractSimpleFileCache <T> {

  getFilePath: (params: T) => Promise<GetFilePathResult>

  abstract getFilePathImpl (params: T): Promise<GetFilePathResult>

  // Load and save the remote file, then return the local path from filesystem
  protected abstract loadRemoteFile (key: string): Promise<GetFilePathResult>

  init (max: number, maxAge: number) {
    this.getFilePath = memoizee(this.getFilePathImpl.bind(this), {
      maxAge,
      max,
      promise: true,
      dispose: (result?: GetFilePathResult) => {
        if (result && result.isOwned !== true) {
          remove(result.path)
            .then(() => logger.debug('%s removed from %s', result.path, this.constructor.name))
            .catch(err => logger.error('Cannot remove %s from cache %s.', result.path, this.constructor.name, { err }))
        }
      }
    })
  }
}
