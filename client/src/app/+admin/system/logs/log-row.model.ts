import { LogLevel } from '@shared/models'
import omit from 'lodash-es/omit'

export class LogRow {
  date: Date
  localeDate: string
  level: LogLevel
  message: string
  meta: string

  by: string
  domain: string
  action: string

  constructor (row: any) {
    this.date = new Date(row.timestamp)
    this.localeDate = this.date.toLocaleString()
    this.level = row.level
    this.message = row.message

    const metaObj = omit(row, 'timestamp', 'level', 'message', 'label')

    if (Object.keys(metaObj).length !== 0) this.meta = JSON.stringify(metaObj, undefined, 2)

    if (row.level === 'audit') {
      try {
        const message = JSON.parse(row.message)

        this.by = message.user
        this.domain = message.domain
        this.action = message.action

        this.meta = JSON.stringify(message, null, 2)
        this.message = ''
      } catch (err) {
        console.error('Cannot parse audit message.', err)
      }
    }
  }
}
