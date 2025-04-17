import { pino } from 'pino'
import pretty from 'pino-pretty'

const logger = pino(pretty({
  colorize: pretty.isColorSupported
}))

logger.level = 'info'

export {
  logger
}
