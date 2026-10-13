import { Model, ModelStatic, Transaction, TransactionOptions } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'
import { createLogger } from './logger.js'

const logger = createLogger()

/**
 *  Reimplement Sequelize managed transactions because they have bugs/inconsistencies on rollback/commit failure:
 *    * Mark the instance persisted even after a rollback
 *    * Runs afterCommit hooks even if the commit fails
 */

type InstanceSnapshot = {
  isNewRecord: boolean
  changed: Set<string>
  previousDataValues: Record<string, unknown>
  // Attributes without value before the insert
  emptyAttributes: Record<string, null | undefined>
}

type ModelInternals = Model & {
  _previousDataValues: Record<string, unknown>
}

type ModelStaticInternals = ModelStatic<Model> & {
  _timestampAttributes: { createdAt?: string, updatedAt?: string }
}

// Transaction -> { [Model -> InstanceSnapshot] }
const savedInstances = new WeakMap<Transaction, Map<Model, InstanceSnapshot>>()
const afterCommitCallbacks = new WeakMap<Transaction, (() => any)[]>()

export function trackInstancesSavedInTransactions (sequelize: Sequelize) {
  sequelize.addHook('beforeSave', (instance: Model, options: { transaction?: Transaction }) => {
    const instances = savedInstances.get(options.transaction)
    if (!instances) return

    const changed = instance.changed() || []

    // Keep the state before the first save in this transaction, but remember fields changed by the next saves
    const existing = instances.get(instance)
    if (existing) {
      for (const key of changed) existing.changed.add(key)
      return
    }

    instances.set(instance, {
      isNewRecord: instance.isNewRecord,
      changed: new Set(changed),
      previousDataValues: { ...(instance as ModelInternals)._previousDataValues },
      emptyAttributes: instance.isNewRecord
        ? getEmptyAttributes(instance)
        : {}
    })
  })
}

export async function runSequelizeTransaction<T> (
  sequelize: Sequelize,
  options: TransactionOptions,
  fn: (t: Transaction) => PromiseLike<T>
): Promise<T> {
  if (options.transaction) throw new Error('Nested transactions (savepoints) are not supported')

  const transaction = await sequelize.transaction(options)

  savedInstances.set(transaction, new Map())
  afterCommitCallbacks.set(transaction, [])

  let result: T

  try {
    result = await fn(transaction)
  } catch (err) {
    try {
      await transaction.rollback()
    } catch (rollbackErr) {
      logger.debug('Cannot rollback transaction.', { err: rollbackErr })
    }

    restoreSavedInstances(transaction)
    throw err
  }

  try {
    await transaction.commit()
  } catch (err) {
    restoreSavedInstances(transaction)
    throw err
  }

  savedInstances.delete(transaction)

  try {
    // Also runs callbacks added by a callback
    for (const callback of afterCommitCallbacks.get(transaction)) {
      try {
        await callback()
      } catch (err) {
        logger.error('Error in transaction after commit callback.', { err })
      }
    }
  } finally {
    afterCommitCallbacks.delete(transaction)
  }

  return result
}

export function addAfterCommitCallback (transaction: Transaction, callback: () => any) {
  const callbacks = afterCommitCallbacks.get(transaction)

  // Transaction not created by runSequelizeTransaction, keep Sequelize behaviour
  // oxlint-disable-next-line no-restricted-properties
  if (!callbacks) return transaction.afterCommit(() => callback())

  callbacks.push(callback)
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function restoreSavedInstances (transaction: Transaction) {
  const instances = savedInstances.get(transaction)

  savedInstances.delete(transaction)
  afterCommitCallbacks.delete(transaction)

  for (const [ model, snapshot ] of instances) {
    const instance = model as ModelInternals

    if (snapshot.isNewRecord) {
      instance.isNewRecord = true

      for (const [ attribute, value ] of Object.entries(snapshot.emptyAttributes)) {
        if (value === undefined) delete instance.dataValues[attribute]
        else instance.dataValues[attribute] = value
      }
    }

    instance._previousDataValues = snapshot.previousDataValues

    for (const key of snapshot.changed) {
      instance.changed(key as keyof Model, true)
    }
  }
}

function getEmptyAttributes (instance: Model) {
  const result: Record<string, null | undefined> = {}
  const modelStatic = instance.constructor as ModelStaticInternals
  const attributes = modelStatic.getAttributes()

  for (const attribute of Object.keys(attributes)) {
    const value = instance.getDataValue(attribute)

    if (value === null || value === undefined) result[attribute] = value
  }

  // `save` sets timestamps before running hooks
  // Reset them if they were not set by the caller or a default value
  for (const attribute of [ modelStatic._timestampAttributes.createdAt, modelStatic._timestampAttributes.updatedAt ]) {
    if (!attribute || instance.changed(attribute as keyof Model)) continue
    if (attributes[attribute].defaultValue !== undefined) continue

    result[attribute] = undefined
  }

  return result
}
