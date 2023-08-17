import { RunnerJobState, RunnerJobStateType } from '@peertube/peertube-models'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { RUNNER_JOBS } from '@server/initializers/constants.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { MRunner, MRunnerJob } from '@server/types/models/runners/index.js'
import express from 'express'

const lTags = loggerTagsFactory('runner')

const updatingRunner = new Set<number>()

function updateLastRunnerContact (req: express.Request, runner: MRunner) {
  const now = new Date()

  // Don't update last runner contact too often
  if (now.getTime() - runner.lastContact.getTime() < RUNNER_JOBS.LAST_CONTACT_UPDATE_INTERVAL) return
  if (updatingRunner.has(runner.id)) return

  updatingRunner.add(runner.id)

  runner.lastContact = now
  runner.ip = req.ip

  logger.debug('Updating last runner contact for %s', runner.name, lTags(runner.name))

  retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(async transaction => {
      return runner.save({ transaction })
    })
  })
  .catch(err => logger.error('Cannot update last runner contact for %s', runner.name, { err, ...lTags(runner.name) }))
  .finally(() => updatingRunner.delete(runner.id))
}

function runnerJobCanBeCancelled (runnerJob: MRunnerJob) {
  const allowedStates = new Set<RunnerJobStateType>([
    RunnerJobState.PENDING,
    RunnerJobState.PROCESSING,
    RunnerJobState.WAITING_FOR_PARENT_JOB
  ])

  return allowedStates.has(runnerJob.state)
}

export {
  updateLastRunnerContact,
  runnerJobCanBeCancelled
}
