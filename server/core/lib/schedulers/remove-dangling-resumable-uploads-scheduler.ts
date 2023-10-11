import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { SCHEDULER_INTERVALS_MS } from '@server/initializers/constants.js'
import { uploadx } from '../uploadx.js'
import { AbstractScheduler } from './abstract-scheduler.js'

const lTags = loggerTagsFactory('scheduler', 'resumable-upload', 'cleaner')

export class RemoveDanglingResumableUploadsScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler
  private lastExecutionTimeMs: number

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.REMOVE_DANGLING_RESUMABLE_UPLOADS

  private constructor () {
    super()

    this.lastExecutionTimeMs = new Date().getTime()
  }

  protected async internalExecute () {
    logger.debug('Removing dangling resumable uploads', lTags())

    const now = new Date().getTime()

    try {
      // Remove files that were not updated since the last execution
      await uploadx.storage.purge(now - this.lastExecutionTimeMs)
    } catch (error) {
      logger.error('Failed to handle file during resumable video upload folder cleanup', { error, ...lTags() })
    } finally {
      this.lastExecutionTimeMs = now
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
