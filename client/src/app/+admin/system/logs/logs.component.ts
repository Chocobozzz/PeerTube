import { NgClass } from '@angular/common'
import { Component, ElementRef, OnInit, inject, viewChild, ChangeDetectionStrategy } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Notifier } from '@app/core'
import { SelectOptionsComponent } from '@app/shared/shared-forms/select/select-options.component'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { ServerLogLevel } from '@peertube/peertube-models'
import { SelectTagsComponent } from '../../../shared/shared-forms/select/select-tags.component'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { CopyButtonComponent } from '../../../shared/shared-main/buttons/copy-button.component'
import { LogRow } from './log-row.model'
import { LogsService } from './logs.service'

@Component({
  templateUrl: './logs.component.html',
  styleUrls: [ './logs.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    FormsModule,
    NgClass,
    SelectTagsComponent,
    ButtonComponent,
    PTDatePipe,
    CopyButtonComponent,
    SelectOptionsComponent
  ]
})
export class LogsComponent implements OnInit {
  private logsService = inject(LogsService)
  private notifier = inject(Notifier)

  readonly logsElement = viewChild<ElementRef<HTMLElement>>('logsElement')
  readonly logsContent = viewChild<ElementRef<HTMLElement>>('logsContent')

  loading = false

  rawLogs: string
  logs: LogRow[] = []

  timeChoices: { id: string, label: string, dateFormat: string }[] = []
  levelChoices: { id: ServerLogLevel, label: string }[] = []

  startDate: string
  level: ServerLogLevel
  tagsOneOf: string[] = []

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

    const tagsOneOf = this.tagsOneOf.length !== 0
      ? this.tagsOneOf
      : undefined

    this.logsService.getLogs({
      level: this.level,
      startDate: this.startDate,
      tagsOneOf
    }).subscribe({
      next: logs => {
        this.logs = logs

        this.rawLogs = this.logs.map(l => `${l.level} ${l.localeDate} ${l.message} ${l.meta}`).join('\n')

        setTimeout(() => {
          this.logsElement().nativeElement.scrollIntoView({ block: 'end', inline: 'nearest' })
        })
      },

      error: err => this.notifier.handleError(err),

      complete: () => this.loading = false
    })
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
}
