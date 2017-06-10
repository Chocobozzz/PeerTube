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
    db.Job.listWithLimit(limit, state, (err, jobs) => {
      this.enqueueJobs(err, jobsQueue, jobs)

      forever(
        next => {
          if (jobsQueue.length() !== 0) {
            // Finish processing the queue first
            return setTimeout(next, JOBS_FETCHING_INTERVAL)
          }

          const state = JOB_STATES.PENDING
          db.Job.listWithLimit(limit, state, (err, jobs) => {
            if (err) {
              logger.error('Cannot list pending jobs.', { error: err })
            } else {
              jobs.forEach(job => {
                jobsQueue.push(job)
              })
            }

            // Optimization: we could use "drain" from queue object
            return setTimeout(next, JOBS_FETCHING_INTERVAL)
          })
        },

        err => { logger.error('Error in job scheduler queue.', { error: err }) }
      )
    })
  }

  createJob (transaction: Sequelize.Transaction, handlerName: string, handlerInputData: object, callback: (err: Error) => void) {
    const createQuery = {
      state: JOB_STATES.PENDING,
      handlerName,
      handlerInputData
    }
    const options = { transaction }

    db.Job.create(createQuery, options).asCallback(callback)
  }

  private enqueueJobs (err: Error, jobsQueue: AsyncQueue<JobInstance>, jobs: JobInstance[]) {
    if (err) {
      logger.error('Cannot list pending jobs.', { error: err })
    } else {
      jobs.forEach(job => {
        jobsQueue.push(job)
      })
    }
  }

  private processJob (job: JobInstance, callback: (err: Error) => void) {
    const jobHandler = jobHandlers[job.handlerName]

    logger.info('Processing job %d with handler %s.', job.id, job.handlerName)

    job.state = JOB_STATES.PROCESSING
    job.save().asCallback(err => {
      if (err) return this.cannotSaveJobError(err, callback)

      if (jobHandler === undefined) {
        logger.error('Unknown job handler for job %s.', job.handlerName)
        return callback(null)
      }

      return jobHandler.process(job.handlerInputData, (err, result) => {
        if (err) {
          logger.error('Error in job handler %s.', job.handlerName, { error: err })
          return this.onJobError(jobHandler, job, result, callback)
        }

        return this.onJobSuccess(jobHandler, job, result, callback)
      })
    })
  }

  private onJobError (jobHandler: JobHandler<any>, job: JobInstance, jobResult: any, callback: (err: Error) => void) {
    job.state = JOB_STATES.ERROR

    job.save().asCallback(err => {
      if (err) return this.cannotSaveJobError(err, callback)

      return jobHandler.onError(err, job.id, jobResult, callback)
    })
  }

  private onJobSuccess (jobHandler: JobHandler<any>, job: JobInstance, jobResult: any, callback: (err: Error) => void) {
    job.state = JOB_STATES.SUCCESS

    job.save().asCallback(err => {
      if (err) return this.cannotSaveJobError(err, callback)

      return jobHandler.onSuccess(err, job.id, jobResult, callback)
    })
  }

  private cannotSaveJobError (err: Error, callback: (err: Error) => void) {
    logger.error('Cannot save new job state.', { error: err })
    return callback(err)
  }
}

// ---------------------------------------------------------------------------

export {
  JobScheduler
}
