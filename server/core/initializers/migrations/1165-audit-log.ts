import { createLogger } from '@server/helpers/logger.js'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import * as Sequelize from 'sequelize'
import { CONFIG } from '../config.js'

const logger = createLogger()

const AUDIT_LOG_FILE_REGEX = /^peertube-audit\d*\.log$/

// Legacy log domain -> entity type and key of the entity id in the flattened entity
const LEGACY_DOMAINS: { [domain: string]: { entityType: string, idKey: string } } = {
  'videos': { entityType: 'video', idKey: 'video-id' },
  'video-imports': { entityType: 'video-import', idKey: 'video-import-id' },
  'comments': { entityType: 'comment', idKey: 'comment-id' },
  'users': { entityType: 'user', idKey: 'user-id' },
  'channels': { entityType: 'channel', idKey: 'channel-id' },
  'channel-syncs': { entityType: 'channel-sync', idKey: 'channelSync-id' },
  'abuse': { entityType: 'abuse', idKey: 'abuse-id' },
  'config': { entityType: 'config', idKey: undefined }
}

type AuditLogRow = {
  action: string
  entityType: string
  entityId: number | null
  username: string
  entity: Record<string, any>
  createdAt: string
}

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction, sequelize } = utils

  {
    const query = `
CREATE TABLE IF NOT EXISTS "auditLog" (
  "id" SERIAL,
  "action" VARCHAR(255) NOT NULL,
  "entityType" VARCHAR(255) NOT NULL,
  "entityId" INTEGER,
  "userId" INTEGER REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "username" VARCHAR(255) NOT NULL,
  "ip" VARCHAR(255),
  "entity" JSONB NOT NULL,
  "changes" JSONB,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);`

    await sequelize.query(query, { transaction })
  }

  await importLegacyAuditLogFiles({ sequelize, transaction })
}

function down () {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}

// ---------------------------------------------------------------------------

async function importLegacyAuditLogFiles (options: {
  sequelize: Sequelize.Sequelize
  transaction: Sequelize.Transaction
}) {
  let files: string[]

  try {
    files = (await readdir(CONFIG.STORAGE.LOG_DIR)).filter(f => AUDIT_LOG_FILE_REGEX.test(f))
  } catch (err) {
    logger.warn('Cannot read log directory to import previous audit log files.', { err })
    return
  }

  if (files.length === 0) return

  let imported = 0

  for (const file of files) {
    const content = await readFile(join(CONFIG.STORAGE.LOG_DIR, file), 'utf-8')
    const rows = content.split('\n').map(line => parseAuditLogLine(line)).filter(r => !!r)

    try {
      await insertRows({ ...options, rows })

      imported += rows.length
    } catch (err) {
      logger.warn(`Failed to import audit log file ${file}.`, { err })
    }
  }

  logger.info(
    `Imported ${imported} audit log entries in the database. ` +
      `The following files are not used anymore and can be removed: ${files.map(f => join(CONFIG.STORAGE.LOG_DIR, f)).join(', ')}`
  )
}

function insertRows (options: {
  sequelize: Sequelize.Sequelize
  transaction: Sequelize.Transaction
  rows: AuditLogRow[]
}) {
  const { sequelize, transaction, rows } = options

  const query = `INSERT INTO "auditLog" ("action", "entityType", "entityId", "username", "entity", "createdAt") ` +
    `SELECT "action", "entityType", "entityId", "username", "entity", "createdAt" ` +
    `FROM jsonb_to_recordset(CAST(:rows AS JSONB)) AS x(` +
    `"action" VARCHAR(255), "entityType" VARCHAR(255), "entityId" INTEGER, "username" VARCHAR(255), ` +
    `"entity" JSONB, "createdAt" TIMESTAMP WITH TIME ZONE` +
    `)`

  // Use a savepoint to not rollback the entire transaction on failure
  return sequelize.transaction({ transaction }, t => {
    return sequelize.query(query, {
      replacements: { rows: JSON.stringify(rows) },
      transaction: t
    })
  })
}

// Legacy entries are flattened objects with a `${prefix}-` key prefix (`video-account-name`)
// Updates also have the changed keys prefixed by `new-` (`new-video-name`)
// We keep them as is in the entity column
function parseAuditLogLine (line: string): AuditLogRow {
  if (!line.trim()) return undefined

  try {
    const log = JSON.parse(line)
    if (log.level !== 'audit' || typeof log.message !== 'string') return undefined

    // PostgreSQL JSONB doesn't support \u0000
    const { user, domain, action, ...entity } = JSON.parse(log.message, (_k, v) => typeof v === 'string' ? v.replace(/\0/g, '') : v)
    if (!domain || !action) return undefined

    const { entityType, idKey } = LEGACY_DOMAINS[domain] ?? { entityType: domain, idKey: undefined }

    return {
      action,
      entityType,
      entityId: (idKey && entity[idKey]) ?? null,
      username: user || 'unknown',
      entity,
      createdAt: log.timestamp
    }
  } catch {
    return undefined
  }
}
