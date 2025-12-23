import retry from 'async/retry.js'
import Bluebird from 'bluebird'
import { Transaction } from 'sequelize'
import { Model } from 'sequelize-typescript'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { logger } from './logger.js'

export function retryTransactionWrapper<T, A, B, C, D> (
  functionToRetry: (arg1: A, arg2: B, arg3: C, arg4: D) => Promise<T>,
  arg1: A,
  arg2: B,
  arg3: C,
  arg4: D
): Promise<T>

export function retryTransactionWrapper<T, A, B, C> (
  functionToRetry: (arg1: A, arg2: B, arg3: C) => Promise<T>,
  arg1: A,
  arg2: B,
  arg3: C
): Promise<T>

export function retryTransactionWrapper<T, A, B> (
  functionToRetry: (arg1: A, arg2: B) => Promise<T>,
  arg1: A,
  arg2: B
): Promise<T>

export function retryTransactionWrapper<T, A> (
  functionToRetry: (arg1: A) => Promise<T>,
  arg1: A
): Promise<T>

export function retryTransactionWrapper<T> (
  functionToRetry: () => Promise<T> | Bluebird<T>
): Promise<T>

export function retryTransactionWrapper<T> (
  functionToRetry: (...args: any[]) => Promise<T>,
  ...args: any[]
): Promise<T> {
  return transactionRetryer<T>(callback => {
    functionToRetry.apply(null, args)
      .then((result: T) => callback(null, result))
      .catch(err => callback(err))
  })
    .catch(err => {
      logger.warn(`Cannot execute ${functionToRetry.name || 'function'} with many retries.`, { err })
      throw err
    })
}

export function transactionRetryer<T> (func: (err: any, data: T) => any) {
  return new Promise<T>((res, rej) => {
    retry(
      {
        times: 5,

        errorFilter: err => {
          const willRetry = err.name === 'SequelizeDatabaseError'
          logger.debug('Maybe retrying the transaction function.', { willRetry, err, tags: [ 'sql', 'retry' ] })
          return willRetry
        }
      },
      func,
      (err, data) => err ? rej(err) : res(data)
    )
  })
}

export function saveInTransactionWithRetries<T extends Pick<Model, 'save' | 'changed'>> (model: T) {
  const changedKeys = model.changed() || []

  return retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(async transaction => {
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
