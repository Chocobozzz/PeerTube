import { LogLevel } from '@shared/models/server/log-level.type'
import omit from 'lodash-es/omit'

export class LogRow {
  date: Date
  localeDate: string
  level: LogLevel
  message: string
  meta: string

  constructor (row: any) {
    this.date = new Date(row.timestamp)
    this.localeDate = this.date.toLocaleString()
    this.level = row.level
    this.message = row.message

    const metaObj = omit(row, 'timestamp', 'level', 'message', 'label')

    if (Object.keys(metaObj).length !== 0) this.meta = JSON.stringify(metaObj, undefined, 2)
  }
}
