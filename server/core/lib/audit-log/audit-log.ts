import { AuditLogAction, AuditLogActionType, AuditLogChange, AuditLogEntityTypeType } from '@peertube/peertube-models'
import { afterCommitIfTransaction } from '@server/helpers/database-utils.js'
import { getAuthUser } from '@server/helpers/express-utils.js'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { AuditLogModel } from '@server/models/server/audit-log.js'
import { MAccountDefault, MUserId } from '@server/types/models/index.js'
import express from 'express'
import anonymize from 'ip-anonymize'
import { ForeignKeyConstraintError, Transaction } from 'sequelize'
import { isDeepStrictEqual } from 'util'

const logger = createLogger()

const HIDDEN_VALUE = '[hidden]'

export type AuditLogActor = {
  userId: number | null
  username: string
  ip: string | null
}

export type AuditLogEntity = {
  type: AuditLogEntityTypeType
  id: number | null
  data: Record<string, any>
}

// Entity state after the action
export type AuditLogEntityLoader = () => AuditLogEntity | Promise<AuditLogEntity>

// Entity state before the action, created by auditLog.snapshot() before running the action
const snapshotKey = Symbol('audit-log-snapshot')
export type AuditLogSnapshot = { readonly [snapshotKey]: AuditLogEntity | null }

type AuditLogAttributes = Pick<AuditLogModel, 'action' | 'entityType' | 'entityId' | 'userId' | 'username' | 'ip' | 'entity' | 'changes'>

type RecordOptions = {
  transaction?: Transaction
}

type UpdateRecordOptions = RecordOptions & {
  secretChanges?: string[]
}

// ---------------------------------------------------------------------------

// The promise resolves when the entry is inserted, and never rejects: an error is logged but doesn't fail the audited action
export const awaitableAuditLog = {
  create (actor: AuditLogActor, entity: AuditLogEntityLoader, options: RecordOptions = {}) {
    return record({ ...options, action: AuditLogAction.CREATE, actor, entity })
  },

  update (actor: AuditLogActor, entity: AuditLogEntityLoader, oldEntity: AuditLogSnapshot, options: UpdateRecordOptions = {}) {
    return record({ ...options, action: AuditLogAction.UPDATE, actor, entity, oldEntity })
  },

  // Use a snapshot if the entity must be loaded from the database before its deletion
  delete (actor: AuditLogActor, entity: AuditLogEntityLoader | AuditLogSnapshot, options: RecordOptions = {}) {
    return record({ ...options, action: AuditLogAction.DELETE, actor, entity })
  }
}

// Entries are inserted asynchronously
export const auditLog = {
  create (...args: Parameters<typeof awaitableAuditLog.create>) {
    void awaitableAuditLog.create(...args)
  },

  update (...args: Parameters<typeof awaitableAuditLog.update>) {
    void awaitableAuditLog.update(...args)
  },

  delete (...args: Parameters<typeof awaitableAuditLog.delete>) {
    void awaitableAuditLog.delete(...args)
  },

  snapshot: snapshotAuditEntity
}

// ---------------------------------------------------------------------------
// Actors
// ---------------------------------------------------------------------------

export function getAuditActorFromRes (res: express.Response): AuditLogActor {
  return getAuditActorFromUser(getAuthUser(res), res.req as express.Request)
}

export function getAuditActorFromUser (user: MUserId & { username: string }, req?: express.Request): AuditLogActor {
  return {
    userId: user.id,
    username: user.username,
    ip: getAuditIP(req)
  }
}

export function getAuditActorFromAccount (account: MAccountDefault): AuditLogActor {
  return {
    userId: account.userId ?? null,
    username: account.Actor.getIdentifier(),
    ip: null
  }
}

// Unauthenticated requests
export function getAuditAnonymousActor (req: express.Request): AuditLogActor {
  return { userId: null, username: 'anonymous', ip: getAuditIP(req) }
}

// Actions triggered by PeerTube itself (scheduled updates...)
export function getAuditSystemActor (): AuditLogActor {
  return { userId: null, username: 'system', ip: null }
}

export function getAuditCLIActor (): AuditLogActor {
  return { userId: null, username: 'cli', ip: null }
}

export function getAuditPluginActor (npmName: string): AuditLogActor {
  return { userId: null, username: 'plugin:' + npmName, ip: null }
}

export function getAuditRunnerActor (runner: { name: string }, req: express.Request): AuditLogActor {
  return { userId: null, username: 'runner:' + runner.name, ip: getAuditIP(req) }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

// Errors are logged and don't fail the audited action
function snapshotAuditEntity (loader: () => AuditLogEntity): AuditLogSnapshot
function snapshotAuditEntity (loader: () => Promise<AuditLogEntity>): Promise<AuditLogSnapshot>
function snapshotAuditEntity (loader: () => AuditLogEntity | Promise<AuditLogEntity>): AuditLogSnapshot | Promise<AuditLogSnapshot> {
  if (!isAuditLogEnabled()) return { [snapshotKey]: null }

  const onError = (err: Error) => {
    logger.error('Cannot snapshot audit log entity', { err })

    return { [snapshotKey]: null }
  }

  try {
    const entity = loader()

    if (entity instanceof Promise) {
      return entity
        .then(e => ({ [snapshotKey]: e }))
        .catch(onError)
    }

    return { [snapshotKey]: entity }
  } catch (err) {
    return onError(err)
  }
}

function isAuditLogEnabled () {
  return CONFIG.LOG.AUDIT.ENABLED === true
}

async function record (
  options: UpdateRecordOptions & {
    action: AuditLogActionType
    actor: AuditLogActor
    entity: AuditLogEntityLoader | AuditLogSnapshot
    oldEntity?: AuditLogSnapshot
  }
): Promise<void> {
  if (!isAuditLogEnabled()) return

  const { action, actor, oldEntity, transaction, secretChanges = [] } = options

  try {
    // Before any await, to get the current state of in memory models
    const entityOrPromise = typeof options.entity === 'function'
      ? options.entity()
      : options.entity[snapshotKey]

    if (transaction) await new Promise<void>(res => afterCommitIfTransaction(transaction, res))

    const entity = await entityOrPromise
    if (!entity) return

    let changes: Record<string, AuditLogChange> = null
    const oldEntityData = oldEntity?.[snapshotKey]?.data

    if (action === AuditLogAction.UPDATE && oldEntityData) {
      changes = {
        ...buildChanges(oldEntityData, entity.data),
        ...Object.fromEntries(secretChanges.map(key => [ key, { old: HIDDEN_VALUE, new: HIDDEN_VALUE } ]))
      }

      // Nothing audited changed
      if (Object.keys(changes).length === 0) return
    }

    await insert({
      action,
      entityType: entity.type,
      entityId: entity.id,
      userId: actor.userId,
      username: actor.username.substring(0, 255),
      ip: actor.ip,
      entity: entity.data,
      changes
    })
  } catch (err) {
    logger.error(`Cannot store audit log of ${action}`, { err })
  }
}

async function insert (attributes: AuditLogAttributes) {
  try {
    await AuditLogModel.create(attributes)
  } catch (err) {
    // The user may have been deleted in the meantime
    if (err instanceof ForeignKeyConstraintError && attributes.userId) {
      await AuditLogModel.create({ ...attributes, userId: null })
      return
    }

    throw err
  }
}

function buildChanges (oldData: Record<string, any>, newData: Record<string, any>) {
  const oldFlat = flattenObject(oldData)
  const newFlat = flattenObject(newData)

  const changes: Record<string, AuditLogChange> = {}

  for (const key of new Set([ ...Object.keys(oldFlat), ...Object.keys(newFlat) ])) {
    const oldValue = oldFlat[key] ?? null
    const newValue = newFlat[key] ?? null

    if (isDeepStrictEqual(oldValue, newValue)) continue

    changes[key] = { old: oldValue, new: newValue }
  }

  return changes
}

function flattenObject (obj: Record<string, any>, prefix = '', result: Record<string, any> = {}) {
  for (const [ key, value ] of Object.entries(obj)) {
    const path = prefix + key

    // A change in an array is reported as a single change
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length !== 0) {
      flattenObject(value, path + '.', result)
    } else {
      result[path] = value
    }
  }

  return result
}

function getAuditIP (req?: express.Request) {
  if (!req?.ip) return null

  if (CONFIG.LOG.ANONYMIZE_IP === true) return anonymize(req.ip, 16, 16)

  return req.ip
}
