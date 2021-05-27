import * as bluebird from 'bluebird'
import { readdir, remove, stat } from 'fs-extra'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { getResumableUploadPath } from '@server/helpers/upload'
import { SCHEDULER_INTERVALS_MS } from '@server/initializers/constants'
import { METAFILE_EXTNAME } from '@uploadx/core'
import { AbstractScheduler } from './abstract-scheduler'

const lTags = loggerTagsFactory('scheduler', 'resumable-upload', 'cleaner')

export class RemoveDanglingResumableUploadsScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler
  private lastExecutionTimeMs: number

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.removeDanglingResumableUploads

  private constructor () {
    super()

    this.lastExecutionTimeMs = new Date().getTime()
  }

  protected async internalExecute () {
    const path = getResumableUploadPath()
    const files = await readdir(path)

    const metafiles = files.filter(f => f.endsWith(METAFILE_EXTNAME))

    if (metafiles.length === 0) return

    logger.debug('Reading resumable video upload folder %s with %d files', path, metafiles.length, lTags())

    try {
      await bluebird.map(metafiles, metafile => {
        return this.deleteIfOlderThan(metafile, this.lastExecutionTimeMs)
      }, { concurrency: 5 })
    } catch (error) {
      logger.error('Failed to handle file during resumable video upload folder cleanup', { error, ...lTags() })
    } finally {
      this.lastExecutionTimeMs = new Date().getTime()
    }
  }

  private async deleteIfOlderThan (metafile: string, olderThan: number) {
    const metafilePath = getResumableUploadPath(metafile)
    const statResult = await stat(metafilePath)

    // Delete uploads that started since a long time
    if (statResult.ctimeMs < olderThan) {
      await remove(metafilePath)

      const datafile = metafilePath.replace(new RegExp(`${METAFILE_EXTNAME}$`), '')
      await remove(datafile)
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
