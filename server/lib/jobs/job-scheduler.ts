import { forever, queue } from 'async'

const db = require('../../initializers/database')
import {
  JOBS_FETCHING_INTERVAL,
  JOBS_FETCH_LIMIT_PER_CYCLE,
  JOB_STATES
} from '../../initializers'
import { logger } from '../../helpers'
import { jobHandlers } from './handlers'

class JobScheduler {

  private static instance: JobScheduler

  private constructor () { }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }

  activate () {
    const limit = JOBS_FETCH_LIMIT_PER_CYCLE

    logger.info('Jobs scheduler activated.')

    const jobsQueue = queue(this.processJob)

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

  createJob (transaction, handlerName, handlerInputData, callback) {
    const createQuery = {
      state: JOB_STATES.PENDING,
      handlerName,
      handlerInputData
    }
    const options = { transaction }

    db.Job.create(createQuery, options).asCallback(callback)
  }

  private enqueueJobs (err, jobsQueue, jobs) {
    if (err) {
      logger.error('Cannot list pending jobs.', { error: err })
    } else {
      jobs.forEach(job => {
        jobsQueue.push(job)
      })
    }
  }

  private processJob (job, callback) {
    const jobHandler = jobHandlers[job.handlerName]

    logger.info('Processing job %d with handler %s.', job.id, job.handlerName)

    job.state = JOB_STATES.PROCESSING
    job.save().asCallback(err => {
      if (err) return this.cannotSaveJobError(err, callback)

      if (jobHandler === undefined) {
        logger.error('Unknown job handler for job %s.', jobHandler.handlerName)
        return callback()
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

  private onJobError (jobHandler, job, jobResult, callback) {
    job.state = JOB_STATES.ERROR

    job.save().asCallback(err => {
      if (err) return this.cannotSaveJobError(err, callback)

      return jobHandler.onError(err, job.id, jobResult, callback)
    })
  }

  private onJobSuccess (jobHandler, job, jobResult, callback) {
    job.state = JOB_STATES.SUCCESS

    job.save().asCallback(err => {
      if (err) return this.cannotSaveJobError(err, callback)

      return jobHandler.onSuccess(err, job.id, jobResult, callback)
    })
  }

  private cannotSaveJobError (err, callback) {
    logger.error('Cannot save new job state.', { error: err })
    return callback(err)
  }
}

// ---------------------------------------------------------------------------

export {
  JobScheduler
}
