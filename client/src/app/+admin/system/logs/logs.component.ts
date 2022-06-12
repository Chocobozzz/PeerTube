import { Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { LocalStorageService, Notifier } from '@app/core'
import { LogLevel } from '@shared/models'
import { LogRow } from './log-row.model'
import { LogsService } from './logs.service'

@Component({
  templateUrl: './logs.component.html',
  styleUrls: [ './logs.component.scss' ]
})
export class LogsComponent implements OnInit {
  private static LOCAL_STORAGE_LOG_TYPE_CHOICE_KEY = 'admin-logs-log-type-choice'

  @ViewChild('logsElement', { static: true }) logsElement: ElementRef<HTMLElement>

  loading = false

  logs: LogRow[] = []
  timeChoices: { id: string, label: string, dateFormat: string }[] = []
  levelChoices: { id: LogLevel, label: string }[] = []
  logTypeChoices: { id: 'audit' | 'standard', label: string }[] = []

  startDate: string
  level: LogLevel
  logType: 'audit' | 'standard'
  tagsOneOf: string[] = []

  constructor (
    private logsService: LogsService,
    private notifier: Notifier,
    private localStorage: LocalStorageService
  ) { }

  ngOnInit (): void {
    this.buildTimeChoices()
    this.buildLevelChoices()
    this.buildLogTypeChoices()

    this.loadPreviousChoices()

    this.load()
  }

  refresh () {
    this.logs = []

    this.localStorage.setItem(LogsComponent.LOCAL_STORAGE_LOG_TYPE_CHOICE_KEY, this.logType)

    this.load()
  }

  load () {
    this.loading = true

    const tagsOneOf = this.tagsOneOf.length !== 0
      ? this.tagsOneOf
      : undefined

    this.logsService.getLogs({
      isAuditLog: this.isAuditLog(),
      level: this.level,
      startDate: this.startDate,
      tagsOneOf
    }).subscribe({
      next: logs => {
        this.logs = logs

        setTimeout(() => {
          this.logsElement.nativeElement.scrollIntoView({ block: 'end', inline: 'nearest' })
        })
      },

      error: err => this.notifier.error(err.message),

      complete: () => this.loading = false
    })
  }

  isAuditLog () {
    return this.logType === 'audit'
  }

  buildTimeChoices () {
    const lastHour = new Date()
    lastHour.setHours(lastHour.getHours() - 1)

    const lastDay = new Date()
    lastDay.setDate(lastDay.getDate() - 1)

    const lastWeek = new Date()
    lastWeek.setDate(lastWeek.getDate() - 7)

    this.timeChoices = [
      {
        id: lastWeek.toISOString(),
        label: $localize`Last week`,
        dateFormat: 'shortDate'
      },
      {
        id: lastDay.toISOString(),
        label: $localize`Last day`,
        dateFormat: 'short'
      },
      {
        id: lastHour.toISOString(),
        label: $localize`Last hour`,
        dateFormat: 'mediumTime'
      }
    ]

    this.startDate = lastHour.toISOString()
  }

  buildLevelChoices () {
    this.levelChoices = [
      {
        id: 'debug',
        label: $localize`debug`
      },
      {
        id: 'info',
        label: $localize`info`
      },
      {
        id: 'warn',
        label: $localize`warning`
      },
      {
        id: 'error',
        label: $localize`error`
      }
    ]

    this.level = 'warn'
  }

  buildLogTypeChoices () {
    this.logTypeChoices = [
      {
        id: 'standard',
        label: $localize`Standard logs`
      },
      {
        id: 'audit',
        label: $localize`Audit logs`
      }
    ]
  }

  private loadPreviousChoices () {
    this.logType = this.localStorage.getItem(LogsComponent.LOCAL_STORAGE_LOG_TYPE_CHOICE_KEY)

    if (this.logType !== 'standard' && this.logType !== 'audit') this.logType = 'audit'
  }
}
