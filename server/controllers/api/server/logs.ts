import * as express from 'express'
import { UserRight } from '../../../../shared/models/users'
import { asyncMiddleware, authenticate, ensureUserHasRight } from '../../../middlewares'
import { mtimeSortFilesDesc } from '../../../../shared/core-utils/logs/logs'
import { readdir, readFile } from 'fs-extra'
import { AUDIT_LOG_FILENAME, MAX_LOGS_OUTPUT_CHARACTERS, LOG_FILENAME } from '../../../initializers/constants'
import { join } from 'path'
import { getAuditLogsValidator, getLogsValidator } from '../../../middlewares/validators/logs'
import { LogLevel } from '../../../../shared/models/server/log-level.type'
import { CONFIG } from '../../../initializers/config'
import { logger } from '@server/helpers/logger'

const logsRouter = express.Router()

logsRouter.get('/logs',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_LOGS),
  getLogsValidator,
  asyncMiddleware(getLogs)
)

logsRouter.get('/audit-logs',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_LOGS),
  getAuditLogsValidator,
  asyncMiddleware(getAuditLogs)
)

// ---------------------------------------------------------------------------

export {
  logsRouter
}

// ---------------------------------------------------------------------------

const auditLogNameFilter = generateLogNameFilter(AUDIT_LOG_FILENAME)
async function getAuditLogs (req: express.Request, res: express.Response) {
  const output = await generateOutput({
    startDateQuery: req.query.startDate,
    endDateQuery: req.query.endDate,
    level: 'audit',
    nameFilter: auditLogNameFilter
  })

  return res.json(output).end()
}

const logNameFilter = generateLogNameFilter(LOG_FILENAME)
async function getLogs (req: express.Request, res: express.Response) {
  const output = await generateOutput({
    startDateQuery: req.query.startDate,
    endDateQuery: req.query.endDate,
    level: req.query.level || 'info',
    nameFilter: logNameFilter
  })

  return res.json(output).end()
}

async function generateOutput (options: {
  startDateQuery: string
  endDateQuery?: string
  level: LogLevel
  nameFilter: RegExp
}) {
  const { startDateQuery, level, nameFilter } = options

  const logFiles = await readdir(CONFIG.STORAGE.LOG_DIR)
  const sortedLogFiles = await mtimeSortFilesDesc(logFiles, CONFIG.STORAGE.LOG_DIR)
  let currentSize = 0

  const startDate = new Date(startDateQuery)
  const endDate = options.endDateQuery ? new Date(options.endDateQuery) : new Date()

  let output: string[] = []

  for (const meta of sortedLogFiles) {
    if (nameFilter.exec(meta.file) === null) continue

    const path = join(CONFIG.STORAGE.LOG_DIR, meta.file)
    logger.debug('Opening %s to fetch logs.', path)

    const result = await getOutputFromFile(path, startDate, endDate, level, currentSize)
    if (!result.output) break

    output = result.output.concat(output)
    currentSize = result.currentSize

    if (currentSize > MAX_LOGS_OUTPUT_CHARACTERS || (result.logTime && result.logTime < startDate.getTime())) break
  }

  return output
}

async function getOutputFromFile (path: string, startDate: Date, endDate: Date, level: LogLevel, currentSize: number) {
  const startTime = startDate.getTime()
  const endTime = endDate.getTime()
  let logTime: number

  const logsLevel: { [ id in LogLevel ]: number } = {
    audit: -1,
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  }

  const content = await readFile(path)
  const lines = content.toString().split('\n')
  const output: any[] = []

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    let log: any

    try {
      log = JSON.parse(line)
    } catch {
      // Maybe there a multiple \n at the end of the file
      continue
    }

    logTime = new Date(log.timestamp).getTime()
    if (logTime >= startTime && logTime <= endTime && logsLevel[log.level] >= logsLevel[level]) {
      output.push(log)

      currentSize += line.length

      if (currentSize > MAX_LOGS_OUTPUT_CHARACTERS) break
    } else if (logTime < startTime) {
      break
    }
  }

  return { currentSize, output: output.reverse(), logTime }
}

function generateLogNameFilter (baseName: string) {
  return new RegExp('^' + baseName.replace(/\.log$/, '') + '\\d*.log$')
}
