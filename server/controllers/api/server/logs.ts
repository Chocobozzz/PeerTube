import * as express from 'express'
import { UserRight } from '../../../../shared/models/users'
import { asyncMiddleware, authenticate, ensureUserHasRight } from '../../../middlewares'
import { mtimeSortFilesDesc } from '../../../../shared/core-utils/logs/logs'
import { readdir, readFile } from 'fs-extra'
import { MAX_LOGS_OUTPUT_CHARACTERS } from '../../../initializers/constants'
import { join } from 'path'
import { getLogsValidator } from '../../../middlewares/validators/logs'
import { LogLevel } from '../../../../shared/models/server/log-level.type'
import { CONFIG } from '../../../initializers/config'

const logsRouter = express.Router()

logsRouter.get('/logs',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_LOGS),
  getLogsValidator,
  asyncMiddleware(getLogs)
)

// ---------------------------------------------------------------------------

export {
  logsRouter
}

// ---------------------------------------------------------------------------

async function getLogs (req: express.Request, res: express.Response) {
  const logFiles = await readdir(CONFIG.STORAGE.LOG_DIR)
  const sortedLogFiles = await mtimeSortFilesDesc(logFiles, CONFIG.STORAGE.LOG_DIR)
  let currentSize = 0

  const startDate = new Date(req.query.startDate)
  const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date()
  const level: LogLevel = req.query.level || 'info'

  let output: string[] = []

  for (const meta of sortedLogFiles) {
    const path = join(CONFIG.STORAGE.LOG_DIR, meta.file)

    const result = await getOutputFromFile(path, startDate, endDate, level, currentSize)
    if (!result.output) break

    output = result.output.concat(output)
    currentSize = result.currentSize

    if (currentSize > MAX_LOGS_OUTPUT_CHARACTERS || (result.logTime && result.logTime < startDate.getTime())) break
  }

  return res.json(output).end()
}

async function getOutputFromFile (path: string, startDate: Date, endDate: Date, level: LogLevel, currentSize: number) {
  const startTime = startDate.getTime()
  const endTime = endDate.getTime()
  let logTime: number

  const logsLevel: { [ id in LogLevel ]: number } = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  }

  const content = await readFile(path)
  const lines = content.toString().split('\n')
  const output: any[] = []

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[ i ]
    let log: any

    try {
      log = JSON.parse(line)
    } catch {
      // Maybe there a multiple \n at the end of the file
      continue
    }

    logTime = new Date(log.timestamp).getTime()
    if (logTime >= startTime && logTime <= endTime && logsLevel[ log.level ] >= logsLevel[ level ]) {
      output.push(log)

      currentSize += line.length

      if (currentSize > MAX_LOGS_OUTPUT_CHARACTERS) break
    } else if (logTime < startTime) {
      break
    }
  }

  return { currentSize, output: output.reverse(), logTime }
}
