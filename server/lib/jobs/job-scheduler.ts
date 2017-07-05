import { forever, queue } from 'async'
import * as Sequelize from 'sequelize'

import { database as db } from '../../initializers/database'
import {
  JOBS_FETCHING_INTERVAL,
  JOBS_FETCH_LIMIT_PER_CYCLE,
  JOB_STATES
} from '../../initializers'
import { logger } from '../../helpers'
import { JobInstance } from '../../models'
import { JobHandler, jobHandlers } from './handlers'

type JobQueueCallback = (err: Error) => void

class JobScheduler {

  private static instance: JobScheduler

  private constructor () { }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }

  activate () {
    const limit = JOBS_FETCH_LIMIT_PER_CYCLE

    logger.info('Jobs scheduler activated.')

    const jobsQueue = queue<JobInstance, JobQueueCallback>(this.processJob.bind(this))

    // Finish processing jobs from a previous start
    const state = JOB_STATES.PROCESSING
    db.Job.listWithLimit(limit, state)
      .then(jobs => {
        this.enqueueJobs(jobsQueue, jobs)

        forever(
          next => {
            if (jobsQueue.length() !== 0) {
              // Finish processing the queue first
              return setTimeout(next, JOBS_FETCHING_INTERVAL)
            }

            const state = JOB_STATES.PENDING
            db.Job.listWithLimit(limit, state)
              .then(jobs => {
                this.enqueueJobs(jobsQueue, jobs)

                // Optimization: we could use "drain" from queue object
                return setTimeout(next, JOBS_FETCHING_INTERVAL)
              })
              .catch(err => logger.error('Cannot list pending jobs.', { error: err }))
          },

          err => logger.error('Error in job scheduler queue.', { error: err })
        )
      })
      .catch(err => logger.error('Cannot list pending jobs.', { error: err }))
  }

  createJob (transaction: Sequelize.Transaction, handlerName: string, handlerInputData: object) {
    const createQuery = {
      state: JOB_STATES.PENDING,
      handlerName,
      handlerInputData
    }
    const options = { transaction }

    return db.Job.create(createQuery, options)
  }

  private enqueueJobs (jobsQueue: AsyncQueue<JobInstance>, jobs: JobInstance[]) {
    jobs.forEach(job => jobsQueue.push(job))
  }

  private processJob (job: JobInstance, callback: (err: Error) => void) {
    const jobHandler = jobHandlers[job.handlerName]
    if (jobHandler === undefined) {
      logger.error('Unknown job handler for job %s.', job.handlerName)
      return callback(null)
    }

    logger.info('Processing job %d with handler %s.', job.id, job.handlerName)

    job.state = JOB_STATES.PROCESSING
    return job.save()
      .then(() => {
        return jobHandler.process(job.handlerInputData)
      })
      .then(
        result => {
          return this.onJobSuccess(jobHandler, job, result)
        },

        err => {
          logger.error('Error in job handler %s.', job.handlerName, { error: err })
          return this.onJobError(jobHandler, job, err)
        }
      )
      .then(() => callback(null))
      .catch(err => {
        this.cannotSaveJobError(err)
        return callback(err)
      })
  }

  private onJobError (jobHandler: JobHandler<any>, job: JobInstance, err: Error) {
    job.state = JOB_STATES.ERROR

    return job.save()
      .then(() => jobHandler.onError(err, job.id))
      .catch(err => this.cannotSaveJobError(err))
  }

  private onJobSuccess (jobHandler: JobHandler<any>, job: JobInstance, jobResult: any) {
    job.state = JOB_STATES.SUCCESS

    return job.save()
      .then(() => jobHandler.onSuccess(job.id, jobResult))
      .catch(err => this.cannotSaveJobError(err))
  }

  private cannotSaveJobError (err: Error) {
    logger.error('Cannot save new job state.', { error: err })
  }
}

// ---------------------------------------------------------------------------

export {
  JobScheduler
}
