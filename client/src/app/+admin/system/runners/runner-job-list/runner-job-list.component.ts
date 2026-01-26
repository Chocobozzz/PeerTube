import { CommonModule } from '@angular/common'
import { Component, OnInit, inject, viewChild } from '@angular/core'
import { ConfirmService, Notifier } from '@app/core'
import { formatICU } from '@app/helpers'
import { RunnerJob, RunnerJobState } from '@peertube/peertube-models'
import { AdvancedInputFilter, AdvancedInputFilterComponent } from '../../../../shared/shared-forms/advanced-input-filter.component'
import { ActionDropdownComponent, DropdownAction } from '../../../../shared/shared-main/buttons/action-dropdown.component'
import { ButtonComponent } from '../../../../shared/shared-main/buttons/button.component'
import { NumberFormatterPipe } from '../../../../shared/shared-main/common/number-formatter.pipe'
import { DataLoaderOptions, TableColumnInfo, TableComponent } from '../../../../shared/shared-tables/table.component'
import { RunnerJobFormatted, RunnerService } from '../runner.service'

type ColumnName = 'uuid' | 'type' | 'state' | 'priority' | 'progress' | 'runner' | 'createdAt' | 'processed'

@Component({
  selector: 'my-runner-job-list',
  templateUrl: './runner-job-list.component.html',
  imports: [
    CommonModule,
    ActionDropdownComponent,
    AdvancedInputFilterComponent,
    ButtonComponent,
    TableComponent,
    NumberFormatterPipe
  ]
})
export class RunnerJobListComponent implements OnInit {
  private runnerService = inject(RunnerService)
  private notifier = inject(Notifier)
  private confirmService = inject(ConfirmService)

  readonly table = viewChild<TableComponent<RunnerJobFormatted, ColumnName>>('table')

  actions: DropdownAction<RunnerJob>[][] = []
  bulkActions: DropdownAction<RunnerJob[]>[][] = []

  inputFilters: AdvancedInputFilter[] = [
    {
      title: $localize`Advanced filters`,
      children: [
        {
          value: 'state:completed',
          label: $localize`Completed jobs`
        },
        {
          value: 'state:pending state:waiting-for-parent-job',
          label: $localize`Pending jobs`
        },
        {
          value: 'state:processing',
          label: $localize`Jobs that are being processed`
        },
        {
          value: 'state:errored state:parent-errored',
          label: $localize`Failed jobs`
        }
      ]
    }
  ]

  columns: TableColumnInfo<ColumnName>[] = [
    { id: 'uuid', label: $localize`UUID`, sortable: false },
    { id: 'type', label: $localize`Type`, sortable: false },
    { id: 'state', label: $localize`State`, sortable: true },
    { id: 'priority', label: $localize`Priority`, sortable: true },
    { id: 'progress', label: $localize`Progress`, sortable: true },
    { id: 'runner', label: $localize`Runner`, sortable: false },
    { id: 'createdAt', label: $localize`Created`, sortable: true },
    { id: 'processed', label: $localize`Processed/Finished`, sortable: false }
  ]

  dataLoader: typeof this._dataLoader

  constructor () {
    this.dataLoader = this._dataLoader.bind(this)
  }

  ngOnInit () {
    this.actions = [
      [
        {
          label: $localize`Cancel this job`,
          handler: job => this.cancelJobs([ job ]),
          isDisplayed: job => this.canCancelJob(job)
        }
      ],
      [
        {
          label: $localize`Delete this job`,
          handler: job => this.removeJobs([ job ])
        }
      ]
    ]

    this.bulkActions = [
      [
        {
          label: $localize`Cancel`,
          handler: jobs => this.cancelJobs(jobs),
          isDisplayed: jobs => jobs.every(j => this.canCancelJob(j))
        }
      ],
      [
        {
          label: $localize`Delete`,
          handler: jobs => this.removeJobs(jobs)
        }
      ]
    ]
  }

  async cancelJobs (jobs: RunnerJob[]) {
    const message = formatICU(
      $localize`Do you really want to cancel {count, plural, =1 {this job} other {{count} jobs}}? Children jobs will also be cancelled.`,
      { count: jobs.length }
    )

    const res = await this.confirmService.confirm(message, $localize`Cancel`)

    if (res === false) return

    this.runnerService.cancelJobs(jobs)
      .subscribe({
        next: () => {
          this.table().loadData()

          this.notifier.success(
            formatICU(
              $localize`{count, plural, =1 {Job cancelled} other {{count} jobs cancelled}}`,
              { count: jobs.length }
            )
          )
        },

        error: err => this.notifier.handleError(err)
      })
  }

  async removeJobs (jobs: RunnerJob[]) {
    const message = formatICU(
      $localize`Do you really want to remove {count, plural, =1 {this job} other {{count} jobs}}? Children jobs will also be removed.`,
      { count: jobs.length }
    )

    const res = await this.confirmService.confirm(message, $localize`Remove`)

    if (res === false) return

    this.runnerService.removeJobs(jobs)
      .subscribe({
        next: () => {
          this.table().loadData()

          this.notifier.success(
            formatICU(
              $localize`{count, plural, =1 {Job removed} other {{count} jobs removed}}`,
              { count: jobs.length }
            )
          )
        },

        error: err => this.notifier.handleError(err)
      })
  }

  getStateBadgeColor (job: RunnerJob) {
    switch (job.state.id) {
      case RunnerJobState.ERRORED:
      case RunnerJobState.PARENT_ERRORED:
        return 'badge-danger'

      case RunnerJobState.COMPLETED:
        return 'badge-success'

      case RunnerJobState.PENDING:
      case RunnerJobState.WAITING_FOR_PARENT_JOB:
        return 'badge-warning'

      default:
        return 'badge-info'
    }
  }

  getRandomRunnerNameBadge (value: string) {
    return this.table().getRandomBadge('runner', value)
  }

  getRandomRunnerTypeBadge (value: string) {
    return this.table().getRandomBadge('type', value)
  }

  private _dataLoader (options: DataLoaderOptions) {
    const { pagination, sort, search } = options

    return this.runnerService.listRunnerJobs({ pagination, sort, search })
  }

  private canCancelJob (job: RunnerJob) {
    return job.state.id === RunnerJobState.PENDING ||
      job.state.id === RunnerJobState.PROCESSING ||
      job.state.id === RunnerJobState.WAITING_FOR_PARENT_JOB
  }
}
