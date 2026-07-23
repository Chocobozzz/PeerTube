import { sequelizeTypescript } from '@server/initializers/database.js'
import { Transaction } from 'sequelize'
import { Model } from 'sequelize-typescript'
import { logger } from './logger.js'

export type RetryTransactionWrapperOptions = {
  // Also retry when the transaction failed because of a unique constraint violation
  retryUniqueConstraintViolation?: boolean // default false
}

export async function retryTransactionWrapper<T> (
  functionToRetry: () => Promise<T>,
  options: RetryTransactionWrapperOptions = {}
): Promise<T> {
  const maxAttempts = 5
  let attempts = 0

  while (true) {
    try {
      return await functionToRetry()
    } catch (err) {
      attempts++

      const willRetry = attempts < maxAttempts && (
        err?.name === 'SequelizeDatabaseError' ||
        (options?.retryUniqueConstraintViolation === true && err?.name === 'SequelizeUniqueConstraintError')
      )

      logger.debug('Maybe retrying the transaction function.', { willRetry, err, tags: [ 'sql', 'retry' ] })

      if (!willRetry) {
        logger.warn(`Cannot execute function with many retries.`, { err, attempts, stack: err?.stack })

        throw err
      }
    }
  }
}

export function saveInTransactionWithRetries<T extends Pick<Model, 'save' | 'changed'>> (
  model: T,
  isolationLevel: Transaction.ISOLATION_LEVELS = Transaction.ISOLATION_LEVELS.SERIALIZABLE
) {
  const changedKeys = model.changed() || []

  return retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction({ isolationLevel }, async transaction => {
      try {
        await model.save({ transaction })
      } catch (err) {
        // Reinit changed keys
        for (const key of changedKeys) {
          model.changed(key as keyof Model, true)
        }

        throw err
      }
    })
  })
}

export function deleteInTransactionWithRetries<T extends Pick<Model, 'destroy'>> (model: T) {
  return retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(async transaction => {
      await model.destroy({ transaction })
    })
  })
}

// ---------------------------------------------------------------------------

export function resetSequelizeInstance<T> (instance: Model<T>) {
  return instance.reload()
}

export function filterNonExistingModels<T extends { hasSameUniqueKeysThan(other: T): boolean }> (
  fromDatabase: T[],
  newModels: T[]
) {
  return fromDatabase.filter(f => !newModels.find(newModel => newModel.hasSameUniqueKeysThan(f)))
}

export function deleteAllModels<T extends Pick<Model, 'destroy'>> (models: T[], transaction: Transaction) {
  return Promise.all(models.map(f => f.destroy({ transaction })))
}

// ---------------------------------------------------------------------------

export function runInReadCommittedTransaction<T> (fn: (t: Transaction) => Promise<T>) {
  const options = { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }

  return sequelizeTypescript.transaction(options, t => fn(t))
}

export function afterCommitIfTransaction (t: Transaction, fn: Function) {
  if (t) return t.afterCommit(() => fn())

  return fn()
}
