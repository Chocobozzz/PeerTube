import { readdir, stat, Stats } from 'fs-extra'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { deleteFileAsync, getResumableUploadPath } from '@server/helpers/utils'
import { SCHEDULER_INTERVALS_MS } from '@server/initializers/constants'
import { AbstractScheduler } from './abstract-scheduler'

const lTags = loggerTagsFactory('scheduler', 'resumable uploads', 'cleaner')

export class RemoveDanglingResumableUploadsScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler
  private now: number

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.removeDanglingResumableUploads

  private constructor () {
    super()
  }

  protected async internalExecute () {
    const path = await getResumableUploadPath()
    const files = await readdir(path)

    logger.debug('Reading resumable video upload folder %s with %d files', path, files.length, lTags())

    // current time (in miliseconds):
    this.now = new Date().getTime()

    try {
      await Promise.all(files.map(f => handleFile(f, this.now)))
    } catch (error) {
      logger.error('Failed to handle file during resumable video upload folder cleanup', { error, ...lTags() })
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

async function handleFile (file: string, now: number) {
  const filePath = getResumableUploadPath(file)
  let statResult: Stats

  try {
    statResult = await stat(filePath)
  } catch (error) {
    logger.error('Failed to run stat for %s', filePath, { error, ...lTags() })
    return
  }

  // time of last status change, plus 1h (in miliseconds):
  const endTime = statResult.ctimeMs + SCHEDULER_INTERVALS_MS.removeDanglingResumableUploads

  if (now > endTime) await deleteFileAsync(filePath)
}
