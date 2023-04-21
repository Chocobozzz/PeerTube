import express from 'express'
import { retryTransactionWrapper } from '@server/helpers/database-utils'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { sequelizeTypescript } from '@server/initializers/database'
import { MRunner } from '@server/types/models/runners'

const lTags = loggerTagsFactory('runner')

const updatingRunner = new Set<number>()

function updateLastRunnerContact (req: express.Request, runner: MRunner) {
  const now = new Date()

  // Don't update last runner contact too often
  if (now.getTime() - runner.lastContact.getTime() < 2000) return
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

export {
  updateLastRunnerContact
}
