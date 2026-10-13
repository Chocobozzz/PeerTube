import { wait } from '@peertube/peertube-core-utils'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { Transaction, TransactionOptions } from 'sequelize'
import { Model } from 'sequelize-typescript'
import { addAfterCommitCallback, runSequelizeTransaction } from './database-transaction.js'
import { createLogger } from './logger.js'

const logger = createLogger()

export type RetryTransactionWrapperOptions = {
  // Also retry when the transaction failed because of a unique constraint violation
  retryUniqueConstraintViolation?: boolean // default false
}

const RETRY_BASE_DELAY_MS = 50
const RETRY_MAX_DELAY_MS = 1000

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
        // The error is rethrown so the caller logs it at the level it deems appropriate.
        // Only warn if we actually burned our retries, since in that case the caller has no way to know
        const level = attempts > 1
          ? 'warn'
          : 'debug'

        logger.log(level, `Cannot execute function with many retries.`, { err, attempts, stack: err?.stack })

        throw err
      }

      await wait(getRetryDelayMs(attempts))
    }
  }
}

// Don't collide concurrent serializations
function getRetryDelayMs (attempts: number) {
  const maxDelay = Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** (attempts - 1))

  return Math.floor(Math.random() * maxDelay)
}

export function runTransaction<T> (fn: (t: Transaction) => PromiseLike<T>): Promise<T>
export function runTransaction<T> (options: TransactionOptions, fn: (t: Transaction) => PromiseLike<T>): Promise<T>
export function runTransaction<T> (
  optionsOrFn: TransactionOptions | ((t: Transaction) => PromiseLike<T>),
  fn?: (t: Transaction) => PromiseLike<T>
): Promise<T> {
  if (typeof optionsOrFn === 'function') return runSequelizeTransaction(sequelizeTypescript, {}, optionsOrFn)

  return runSequelizeTransaction(sequelizeTypescript, optionsOrFn, fn)
}

export function saveInTransactionWithRetries<T extends Pick<Model, 'save'>> (
  model: T,
  isolationLevel: Transaction.ISOLATION_LEVELS = Transaction.ISOLATION_LEVELS.SERIALIZABLE
) {
  return retryTransactionWrapper(() => {
    return runTransaction({ isolationLevel }, async transaction => {
      await model.save({ transaction })
    })
  })
}

export function deleteInTransactionWithRetries<T extends Pick<Model, 'destroy'>> (model: T) {
  return retryTransactionWrapper(() => {
    return runTransaction(async transaction => {
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

  return runTransaction(options, t => fn(t))
}

export function afterCommitIfTransaction (t: Transaction, fn: Function) {
  if (t) return addAfterCommitCallback(t, () => fn())

  return fn()
}
