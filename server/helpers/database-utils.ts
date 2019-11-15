import * as retry from 'async/retry'
import * as Bluebird from 'bluebird'
import { Model } from 'sequelize-typescript'
import { logger } from './logger'
import { Transaction } from 'sequelize'

function retryTransactionWrapper <T, A, B, C> (
  functionToRetry: (arg1: A, arg2: B, arg3: C) => Promise<T> | Bluebird<T>,
  arg1: A,
  arg2: B,
  arg3: C
): Promise<T>

function retryTransactionWrapper <T, A, B> (
  functionToRetry: (arg1: A, arg2: B) => Promise<T> | Bluebird<T>,
  arg1: A,
  arg2: B
): Promise<T>

function retryTransactionWrapper <T, A> (
  functionToRetry: (arg1: A) => Promise<T> | Bluebird<T>,
  arg1: A
): Promise<T>

function retryTransactionWrapper <T> (
  functionToRetry: () => Promise<T> | Bluebird<T>
): Promise<T>

function retryTransactionWrapper <T> (
  functionToRetry: (...args: any[]) => Promise<T> | Bluebird<T>,
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
          logger.debug('Maybe retrying the transaction function.', { willRetry, err })
          return willRetry
        }
      },
      func,
      (err, data) => err ? rej(err) : res(data)
    )
  })
}

function updateInstanceWithAnother <T extends Model<T>> (instanceToUpdate: Model<T>, baseInstance: Model<T>) {
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

function afterCommitIfTransaction (t: Transaction, fn: Function) {
  if (t) return t.afterCommit(() => fn())

  return fn()
}

function deleteNonExistingModels <T extends { hasSameUniqueKeysThan (other: T): boolean } & Model<T>> (
  fromDatabase: T[],
  newModels: T[],
  t: Transaction
) {
  return fromDatabase.filter(f => !newModels.find(newModel => newModel.hasSameUniqueKeysThan(f)))
              .map(f => f.destroy({ transaction: t }))
}

// ---------------------------------------------------------------------------

export {
  resetSequelizeInstance,
  retryTransactionWrapper,
  transactionRetryer,
  updateInstanceWithAnother,
  afterCommitIfTransaction,
  deleteNonExistingModels
}
