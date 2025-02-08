import { NgClass, NgFor, NgIf } from '@angular/common'
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { LocalStorageService, Notifier } from '@app/core'
import { SelectOptionsComponent } from '@app/shared/shared-forms/select/select-options.component'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { PeerTubeTemplateDirective } from '@app/shared/shared-main/common/peertube-template.directive'
import { ServerLogLevel } from '@peertube/peertube-models'
import { SelectTagsComponent } from '../../../shared/shared-forms/select/select-tags.component'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { CopyButtonComponent } from '../../../shared/shared-main/buttons/copy-button.component'
import { LogRow } from './log-row.model'
import { LogsService } from './logs.service'

@Component({
  templateUrl: './logs.component.html',
  styleUrls: [ './logs.component.scss' ],
  imports: [
    FormsModule,
    NgFor,
    NgIf,
    NgClass,
    SelectTagsComponent,
    ButtonComponent,
    PTDatePipe,
    CopyButtonComponent,
    SelectOptionsComponent,
    PeerTubeTemplateDirective
  ]
})
export class LogsComponent implements OnInit {
  private static LS_LOG_TYPE_CHOICE_KEY = 'admin-logs-log-type-choice'

  @ViewChild('logsElement', { static: true }) logsElement: ElementRef<HTMLElement>
  @ViewChild('logsContent', { static: true }) logsContent: ElementRef<HTMLElement>

  loading = false

  rawLogs: string
  logs: LogRow[] = []

  timeChoices: { id: string, label: string, dateFormat: string }[] = []
  levelChoices: { id: ServerLogLevel, label: string }[] = []
  logTypeChoices: { id: 'audit' | 'standard', label: string }[] = []

  startDate: string
  level: ServerLogLevel
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

    this.localStorage.setItem(LogsComponent.LS_LOG_TYPE_CHOICE_KEY, this.logType)

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

        this.rawLogs = this.logs.map(l => `${l.level} ${l.localeDate} ${l.message} ${l.meta}`).join('\n')

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
    this.logType = this.localStorage.getItem(LogsComponent.LS_LOG_TYPE_CHOICE_KEY)

    if (this.logType !== 'standard' && this.logType !== 'audit') this.logType = 'audit'
  }
}
