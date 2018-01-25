import { JobQueue } from '../job-queue'
import { AbstractScheduler } from './abstract-scheduler'

export class RemoveOldJobsScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler

  private constructor () {
    super()
  }

  async execute () {
    JobQueue.Instance.removeOldJobs()
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
