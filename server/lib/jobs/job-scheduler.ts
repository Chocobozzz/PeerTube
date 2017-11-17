import { AsyncQueue, forever, queue } from 'async'
import * as Sequelize from 'sequelize'
import { JobCategory } from '../../../shared'
import { logger } from '../../helpers'
import { database as db, JOB_STATES, JOBS_FETCH_LIMIT_PER_CYCLE, JOBS_FETCHING_INTERVAL } from '../../initializers'
import { JobInstance } from '../../models'

export interface JobHandler<P, T> {
  process (data: object, jobId: number): Promise<T>
  onError (err: Error, jobId: number)
  onSuccess (jobId: number, jobResult: T, jobScheduler: JobScheduler<P, T>): Promise<any>
}
type JobQueueCallback = (err: Error) => void

class JobScheduler<P, T> {

  constructor (
    private jobCategory: JobCategory,
    private jobHandlers: { [ id: string ]: JobHandler<P, T> }
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

  createJob (transaction: Sequelize.Transaction, handlerName: string, handlerInputData: P) {
    const createQuery = {
      state: JOB_STATES.PENDING,
      category: this.jobCategory,
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
      const errorString = 'Unknown job handler ' + job.handlerName + ' for job ' + job.id
      logger.error(errorString)

      const error = new Error(errorString)
      await this.onJobError(jobHandler, job, error)
      return callback(error)
    }

    logger.info('Processing job %d with handler %s.', job.id, job.handlerName)

    job.state = JOB_STATES.PROCESSING
    await job.save()

    try {
      const result: T = await jobHandler.process(job.handlerInputData, job.id)
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

    return callback(null)
  }

  private async onJobError (jobHandler: JobHandler<P, T>, job: JobInstance, err: Error) {
    job.state = JOB_STATES.ERROR

    try {
      await job.save()
      if (jobHandler) await jobHandler.onError(err, job.id)
    } catch (err) {
      this.cannotSaveJobError(err)
    }
  }

  private async onJobSuccess (jobHandler: JobHandler<P, T>, job: JobInstance, jobResult: T) {
    job.state = JOB_STATES.SUCCESS

    try {
      await job.save()
      await jobHandler.onSuccess(job.id, jobResult, this)
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
