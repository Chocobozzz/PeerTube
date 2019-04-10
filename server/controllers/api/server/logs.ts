import * as express from 'express'
import { UserRight } from '../../../../shared/models/users'
import { asyncMiddleware, authenticate, ensureUserHasRight } from '../../../middlewares'
import { mtimeSortFilesDesc } from '../../../../shared/utils/logs/logs'
import { readdir } from 'fs-extra'
import { CONFIG, MAX_LOGS_OUTPUT_CHARACTERS } from '../../../initializers'
import { createInterface } from 'readline'
import { createReadStream } from 'fs'
import { join } from 'path'
import { getLogsValidator } from '../../../middlewares/validators/logs'
import { LogLevel } from '../../../../shared/models/server/log-level.type'

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

  let output = ''

  for (const meta of sortedLogFiles) {
    const path = join(CONFIG.STORAGE.LOG_DIR, meta.file)

    const result = await getOutputFromFile(path, startDate, endDate, level, currentSize)
    if (!result.output) break

    output = output + result.output
    currentSize = result.currentSize

    if (currentSize > MAX_LOGS_OUTPUT_CHARACTERS) break
  }

  return res.json(output).end()
}

function getOutputFromFile (path: string, startDate: Date, endDate: Date, level: LogLevel, currentSize: number) {
  const startTime = startDate.getTime()
  const endTime = endDate.getTime()

  const logsLevel: { [ id in LogLevel ]: number } = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  }

  return new Promise<{ output: string, currentSize: number }>(res => {
    const stream = createReadStream(path)
    let output = ''

    stream.once('close', () => res({ output, currentSize }))

    const rl = createInterface({
      input: stream
    })

    rl.on('line', line => {
      const log = JSON.parse(line)

      const logTime = new Date(log.timestamp).getTime()
      if (logTime >= startTime && logTime <= endTime && logsLevel[log.level] >= logsLevel[level]) {
        output += line

        currentSize += line.length

        if (currentSize > MAX_LOGS_OUTPUT_CHARACTERS) stream.close()
      }
    })
  })
}
