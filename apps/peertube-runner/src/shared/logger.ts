import { pino } from 'pino'
import pretty from 'pino-pretty'

const logger = pino(pretty.default({
  colorize: true
}))

logger.level = 'info'

export {
  logger
}
