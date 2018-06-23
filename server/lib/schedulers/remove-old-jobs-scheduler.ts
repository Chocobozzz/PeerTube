import { isTestInstance } from '../../helpers/core-utils'
import { logger } from '../../helpers/logger'
import { JobQueue } from '../job-queue'
import { AbstractScheduler } from './abstract-scheduler'
import { SCHEDULER_INTERVALS_MS } from '../../initializers'

export class RemoveOldJobsScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.removeOldJobs

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
