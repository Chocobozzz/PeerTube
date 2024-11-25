import { pino } from 'pino'
import pretty from 'pino-pretty'

const logger = pino(pretty({
  colorize: true
}))

logger.level = 'info'

export {
  logger
}
