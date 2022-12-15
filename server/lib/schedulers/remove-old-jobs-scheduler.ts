import { isTestOrDevInstance } from '../../helpers/core-utils'
import { logger } from '../../helpers/logger'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants'
import { JobQueue } from '../job-queue'
import { AbstractScheduler } from './abstract-scheduler'

// FIXME: delete this scheduler in a few versions (introduced in 5.0)
// We introduced job removal directly using bullmq option but we still need to delete old jobs
export class RemoveOldJobsScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.REMOVE_OLD_JOBS

  private constructor () {
    super()
  }

  protected internalExecute () {
    if (!isTestOrDevInstance()) logger.info('Removing old jobs in scheduler.')

    return JobQueue.Instance.removeOldJobs()
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
