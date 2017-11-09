import { AsyncQueue, forever, queue } from 'async'
import * as Sequelize from 'sequelize'

import {
  database as db,
  JOBS_FETCHING_INTERVAL,
  JOBS_FETCH_LIMIT_PER_CYCLE,
  JOB_STATES
} from '../../initializers'
import { logger } from '../../helpers'
import { JobInstance } from '../../models'
import { JobCategory } from '../../../shared'

export interface JobHandler<T> {
  process (data: object, jobId: number): T
  onError (err: Error, jobId: number)
  onSuccess (jobId: number, jobResult: T)
}
type JobQueueCallback = (err: Error) => void

class JobScheduler<T> {

  constructor (
    private jobCategory: JobCategory,
    private jobHandlers: { [ id: string ]: JobHandler<T> }
  ) {}

  async activate () {
    const limit = JOBS_FETCH_LIMIT_PER_CYCLE[this.jobCategory]

    logger.info('Jobs scheduler %s activated.', this.jobCategory)

    const jobsQueue = queue<JobInstance, JobQueueCallback>(this.processJob.bind(this))

    // Finish processing jobs from a previous start
    const state = JOB_STATES.PROCESSING
    try {
      const jobs = await db.Job.listWithLimitByCategory(limit, state, this.jobCategory)

      this.enqueueJobs(jobsQueue, jobs)
    } catch (err) {
      logger.error('Cannot list pending jobs.', err)
    }

    forever(
      async next => {
        if (jobsQueue.length() !== 0) {
          // Finish processing the queue first
          return setTimeout(next, JOBS_FETCHING_INTERVAL)
        }

        const state = JOB_STATES.PENDING
        try {
          const jobs = await db.Job.listWithLimitByCategory(limit, state, this.jobCategory)

          this.enqueueJobs(jobsQueue, jobs)
        } catch (err) {
          logger.error('Cannot list pending jobs.', err)
        }

        // Optimization: we could use "drain" from queue object
        return setTimeout(next, JOBS_FETCHING_INTERVAL)
      },

      err => logger.error('Error in job scheduler queue.', err)
    )
  }

  createJob (transaction: Sequelize.Transaction, category: JobCategory, handlerName: string, handlerInputData: object) {
    const createQuery = {
      state: JOB_STATES.PENDING,
      category,
      handlerName,
      handlerInputData
    }
    const options = { transaction }

    return db.Job.create(createQuery, options)
  }

  private enqueueJobs (jobsQueue: AsyncQueue<JobInstance>, jobs: JobInstance[]) {
    jobs.forEach(job => jobsQueue.push(job))
  }

  private async processJob (job: JobInstance, callback: (err: Error) => void) {
    const jobHandler = this.jobHandlers[job.handlerName]
    if (jobHandler === undefined) {
      logger.error('Unknown job handler for job %s.', job.handlerName)
      return callback(null)
    }

    logger.info('Processing job %d with handler %s.', job.id, job.handlerName)

    job.state = JOB_STATES.PROCESSING
    await job.save()

    try {
      const result = await jobHandler.process(job.handlerInputData, job.id)
      await this.onJobSuccess(jobHandler, job, result)
    } catch (err) {
      logger.error('Error in job handler %s.', job.handlerName, err)

      try {
        await this.onJobError(jobHandler, job, err)
      } catch (innerErr) {
        this.cannotSaveJobError(innerErr)
        return callback(innerErr)
      }
    }

    callback(null)
  }

  private async onJobError (jobHandler: JobHandler<any>, job: JobInstance, err: Error) {
    job.state = JOB_STATES.ERROR

    try {
      await job.save()
      await jobHandler.onError(err, job.id)
    } catch (err) {
      this.cannotSaveJobError(err)
    }
  }

  private async onJobSuccess (jobHandler: JobHandler<any>, job: JobInstance, jobResult: any) {
    job.state = JOB_STATES.SUCCESS

    try {
      await job.save()
      jobHandler.onSuccess(job.id, jobResult)
    } catch (err) {
      this.cannotSaveJobError(err)
    }
  }

  private cannotSaveJobError (err: Error) {
    logger.error('Cannot save new job state.', err)
  }
}

// ---------------------------------------------------------------------------

export {
  JobScheduler
}
