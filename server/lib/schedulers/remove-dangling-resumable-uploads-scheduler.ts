import { readdir, stat, Stats } from 'fs-extra'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { getResumableUploadPath } from '@server/helpers/upload'
import { deleteFileAndCatch } from '@server/helpers/utils'
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

  private async deleteIfOlderThan (file: string, limit: number) {
    const filePath = getResumableUploadPath(file)
    let statResult: Stats

    try {
      statResult = await stat(filePath)
    } catch (error) {
      logger.error('Failed to run stat for %s', filePath, { error, ...lTags() })
      return
    }

    if (statResult.ctimeMs < limit) {
      await Promise.all([
        deleteFileAndCatch(filePath),
        deleteFileAndCatch(filePath + METAFILE_EXTNAME) // also delete the .META file, which was not updated since the initial POST request
      ])
    }
  }

  protected async internalExecute () {
    const path = getResumableUploadPath()
    const files = await readdir(path)
      .then(files => files.filter(filename => !filename.includes(METAFILE_EXTNAME))) // exclude .META files, which are not updated at PUT

    logger.debug('Reading resumable video upload folder %s with %d files', path, files.length, lTags())

    try {
      await Promise.all(files.map(file => this.deleteIfOlderThan(file, this.lastExecutionTimeMs)))
    } catch (error) {
      logger.error('Failed to handle file during resumable video upload folder cleanup', { error, ...lTags() })
    } finally {
      this.lastExecutionTimeMs = new Date().getTime()
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
