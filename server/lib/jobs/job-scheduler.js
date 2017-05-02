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
  logger.info('Jobs scheduler activated.')

  const jobsQueue = queue(processJob)

  forever(
    function (next) {
      if (jobsQueue.length() !== 0) {
        // Finish processing the queue first
        return setTimeout(next, constants.JOBS_FETCHING_INTERVAL)
      }

      db.Job.listWithLimit(constants.JOBS_FETCH_LIMIT_PER_CYCLE, function (err, jobs) {
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
}

// ---------------------------------------------------------------------------

module.exports = jobScheduler

// ---------------------------------------------------------------------------

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
        return onJobError(jobHandler, job, callback)
      }

      return onJobSuccess(jobHandler, job, callback)
    })
  })
}

function onJobError (jobHandler, job, callback) {
  job.state = constants.JOB_STATES.ERROR

  job.save().asCallback(function (err) {
    if (err) return cannotSaveJobError(err, callback)

    return jobHandler.onError(err, job.id, callback)
  })
}

function onJobSuccess (jobHandler, job, callback) {
  job.state = constants.JOB_STATES.SUCCESS

  job.save().asCallback(function (err) {
    if (err) return cannotSaveJobError(err, callback)

    return jobHandler.onSuccess(err, job.id, callback)
  })
}

function cannotSaveJobError (err, callback) {
  logger.error('Cannot save new job state.', { error: err })
  return callback(err)
}
