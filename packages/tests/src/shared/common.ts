import { createLogger, transports } from 'winston'

export function createConsoleLogger () {
  return createLogger({ transports: [ new transports.Console() ] })
}
