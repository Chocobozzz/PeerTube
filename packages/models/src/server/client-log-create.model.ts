import { ClientLogLevel } from './client-log-level.type.js'

export interface ClientLogCreate {
  message: string
  url: string
  level: ClientLogLevel

  stackTrace?: string
  userAgent?: string
  meta?: string
}
