'use strict'

const forever = require('async/forever')
const queue = require('async/queue')

const constants = require('../../initializers/constants')
const db = require('../../initializers/database')
const logger = require('../../helpers/logger')

const jobHandlers = require('./handlers')

const jobScheduler = {
  activate,
  createJob
}

function activate () {
  const limit = constants.JOBS_FETCH_LIMIT_PER_CYCLE

  logger.info('Jobs scheduler activated.')

  const jobsQueue = queue(processJob)

  // Finish processing jobs from a previous start
  const state = constants.JOB_STATES.PROCESSING
  db.Job.listWithLimit(limit, state, function (err, jobs) {
    enqueueJobs(err, jobsQueue, jobs)

    forever(
      function (next) {
        if (jobsQueue.length() !== 0) {
          // Finish processing the queue first
          return setTimeout(next, constants.JOBS_FETCHING_INTERVAL)
        }

        const state = constants.JOB_STATES.PENDING
        db.Job.listWithLimit(limit, state, function (err, jobs) {
          if (err) {
            logger.error('Cannot list pending jobs.', { error: err })
          } else {
            jobs.forEach(function (job) {
              jobsQueue.push(job)
            })
          }

          // Optimization: we could use "drain" from queue object
          return setTimeout(next, constants.JOBS_FETCHING_INTERVAL)
        })
      }
    )
  })
}

// ---------------------------------------------------------------------------

module.exports = jobScheduler

// ---------------------------------------------------------------------------

function enqueueJobs (err, jobsQueue, jobs) {
  if (err) {
    logger.error('Cannot list pending jobs.', { error: err })
  } else {
    jobs.forEach(function (job) {
      jobsQueue.push(job)
    })
  }
}

function createJob (transaction, handlerName, handlerInputData, callback) {
  const createQuery = {
    state: constants.JOB_STATES.PENDING,
    handlerName,
    handlerInputData
  }
  const options = { transaction }

  db.Job.create(createQuery, options).asCallback(callback)
}

function processJob (job, callback) {
  const jobHandler = jobHandlers[job.handlerName]

  logger.info('Processing job %d with handler %s.', job.id, job.handlerName)

  job.state = constants.JOB_STATES.PROCESSING
  job.save().asCallback(function (err) {
    if (err) return cannotSaveJobError(err, callback)

    if (jobHandler === undefined) {
      logger.error('Unknown job handler for job %s.', jobHandler.handlerName)
      return callback()
    }

    return jobHandler.process(job.handlerInputData, function (err, result) {
      if (err) {
        logger.error('Error in job handler %s.', job.handlerName, { error: err })
        return onJobError(jobHandler, job, result, callback)
      }

      return onJobSuccess(jobHandler, job, result, callback)
    })
  })
}

function onJobError (jobHandler, job, jobResult, callback) {
  job.state = constants.JOB_STATES.ERROR

  job.save().asCallback(function (err) {
    if (err) return cannotSaveJobError(err, callback)

    return jobHandler.onError(err, job.id, jobResult, callback)
  })
}

function onJobSuccess (jobHandler, job, jobResult, callback) {
  job.state = constants.JOB_STATES.SUCCESS

  job.save().asCallback(function (err) {
    if (err) return cannotSaveJobError(err, callback)

    return jobHandler.onSuccess(err, job.id, jobResult, callback)
  })
}

function cannotSaveJobError (err, callback) {
  logger.error('Cannot save new job state.', { error: err })
  return callback(err)
}
