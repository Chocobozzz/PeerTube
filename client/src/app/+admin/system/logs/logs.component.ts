import { Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { LogsService } from '@app/+admin/system/logs/logs.service'
import { Notifier } from '@app/core'
import { LogRow } from '@app/+admin/system/logs/log-row.model'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { LogLevel } from '@shared/models/server/log-level.type'

@Component({
  templateUrl: './logs.component.html',
  styleUrls: [ './logs.component.scss' ]
})
export class LogsComponent implements OnInit {
  @ViewChild('logsElement', { static: true }) logsElement: ElementRef<HTMLElement>

  loading = false

  logs: LogRow[] = []
  timeChoices: { id: string, label: string }[] = []
  levelChoices: { id: LogLevel, label: string }[] = []

  startDate: string
  level: LogLevel

  constructor (
    private logsService: LogsService,
    private notifier: Notifier,
    private i18n: I18n
  ) { }

  ngOnInit (): void {
    this.buildTimeChoices()
    this.buildLevelChoices()

    this.load()
  }

  refresh () {
    this.logs = []
    this.load()
  }

  load () {
    this.loading = true

    this.logsService.getLogs(this.level, this.startDate)
        .subscribe(
          logs => {
            this.logs = logs

            setTimeout(() => {
              this.logsElement.nativeElement.scrollIntoView({ block: 'end', inline: 'nearest' })
            })
          },

          err => this.notifier.error(err.message),

          () => this.loading = false
        )
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
        label: this.i18n('Last week')
      },
      {
        id: lastDay.toISOString(),
        label: this.i18n('Last day')
      },
      {
        id: lastHour.toISOString(),
        label: this.i18n('Last hour')
      }
    ]

    this.startDate = lastHour.toISOString()
  }

  buildLevelChoices () {
    this.levelChoices = [
      {
        id: 'debug',
        label: this.i18n('Debug')
      },
      {
        id: 'info',
        label: this.i18n('Info')
      },
      {
        id: 'warn',
        label: this.i18n('Warning')
      },
      {
        id: 'error',
        label: this.i18n('Error')
      }
    ]

    this.level = 'warn'
  }
}
