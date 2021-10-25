import retry from 'async/retry'
import Bluebird from 'bluebird'
import { Transaction } from 'sequelize'
import { Model } from 'sequelize-typescript'
import { sequelizeTypescript } from '@server/initializers/database'
import { logger } from './logger'

function retryTransactionWrapper <T, A, B, C, D> (
  functionToRetry: (arg1: A, arg2: B, arg3: C, arg4: D) => Promise<T>,
  arg1: A,
  arg2: B,
  arg3: C,
  arg4: D,
): Promise<T>

function retryTransactionWrapper <T, A, B, C> (
  functionToRetry: (arg1: A, arg2: B, arg3: C) => Promise<T>,
  arg1: A,
  arg2: B,
  arg3: C
): Promise<T>

function retryTransactionWrapper <T, A, B> (
  functionToRetry: (arg1: A, arg2: B) => Promise<T>,
  arg1: A,
  arg2: B
): Promise<T>

function retryTransactionWrapper <T, A> (
  functionToRetry: (arg1: A) => Promise<T>,
  arg1: A
): Promise<T>

function retryTransactionWrapper <T> (
  functionToRetry: () => Promise<T> | Bluebird<T>
): Promise<T>

function retryTransactionWrapper <T> (
  functionToRetry: (...args: any[]) => Promise<T>,
  ...args: any[]
): Promise<T> {
  return transactionRetryer<T>(callback => {
    functionToRetry.apply(null, args)
        .then((result: T) => callback(null, result))
        .catch(err => callback(err))
  })
  .catch(err => {
    logger.error(`Cannot execute ${functionToRetry.name} with many retries.`, { err })
    throw err
  })
}

function transactionRetryer <T> (func: (err: any, data: T) => any) {
  return new Promise<T>((res, rej) => {
    retry(
      {
        times: 5,

        errorFilter: err => {
          const willRetry = (err.name === 'SequelizeDatabaseError')
          logger.debug('Maybe retrying the transaction function.', { willRetry, err, tags: [ 'sql', 'retry' ] })
          return willRetry
        }
      },
      func,
      (err, data) => err ? rej(err) : res(data)
    )
  })
}

// ---------------------------------------------------------------------------

function updateInstanceWithAnother <M, T extends U, U extends Model<M>> (instanceToUpdate: T, baseInstance: U) {
  const obj = baseInstance.toJSON()

  for (const key of Object.keys(obj)) {
    instanceToUpdate[key] = obj[key]
  }
}

function resetSequelizeInstance (instance: Model<any>, savedFields: object) {
  Object.keys(savedFields).forEach(key => {
    instance[key] = savedFields[key]
  })
}

function filterNonExistingModels <T extends { hasSameUniqueKeysThan (other: T): boolean }> (
  fromDatabase: T[],
  newModels: T[]
) {
  return fromDatabase.filter(f => !newModels.find(newModel => newModel.hasSameUniqueKeysThan(f)))
}

function deleteAllModels <T extends Pick<Model, 'destroy'>> (models: T[], transaction: Transaction) {
  return Promise.all(models.map(f => f.destroy({ transaction })))
}

// ---------------------------------------------------------------------------

function runInReadCommittedTransaction <T> (fn: (t: Transaction) => Promise<T>) {
  const options = { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }

  return sequelizeTypescript.transaction(options, t => fn(t))
}

function afterCommitIfTransaction (t: Transaction, fn: Function) {
  if (t) return t.afterCommit(() => fn())

  return fn()
}

// ---------------------------------------------------------------------------

export {
  resetSequelizeInstance,
  retryTransactionWrapper,
  transactionRetryer,
  updateInstanceWithAnother,
  afterCommitIfTransaction,
  filterNonExistingModels,
  deleteAllModels,
  runInReadCommittedTransaction
}
