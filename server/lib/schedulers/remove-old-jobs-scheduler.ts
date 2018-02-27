import { isTestInstance } from '../../helpers/core-utils'
import { logger } from '../../helpers/logger'
import { JobQueue } from '../job-queue'
import { AbstractScheduler } from './abstract-scheduler'

export class RemoveOldJobsScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler

  private constructor () {
    super()
  }

  async execute () {
    if (!isTestInstance()) logger.info('Removing old jobs (scheduler).')

    JobQueue.Instance.removeOldJobs()
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
