import { SortMeta, SharedModule } from 'primeng/api'
import { Component, OnInit } from '@angular/core'
import { ConfirmService, Notifier, RestPagination, RestTable } from '@app/core'
import { formatICU } from '@app/helpers'
import { RunnerJob, RunnerJobState } from '@peertube/peertube-models'
import { RunnerJobFormatted, RunnerService } from '../runner.service'
import { AutoColspanDirective } from '../../../../shared/shared-main/angular/auto-colspan.directive'
import { TableExpanderIconComponent } from '../../../../shared/shared-tables/table-expander-icon.component'
import { ButtonComponent } from '../../../../shared/shared-main/buttons/button.component'
import { AdvancedInputFilter, AdvancedInputFilterComponent } from '../../../../shared/shared-forms/advanced-input-filter.component'
import { ActionDropdownComponent, DropdownAction } from '../../../../shared/shared-main/buttons/action-dropdown.component'
import { NgIf, NgClass } from '@angular/common'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { TableModule } from 'primeng/table'
import { RouterLink } from '@angular/router'
import { GlobalIconComponent } from '../../../../shared/shared-icons/global-icon.component'

@Component({
  selector: 'my-runner-job-list',
  templateUrl: './runner-job-list.component.html',
  standalone: true,
  imports: [
    GlobalIconComponent,
    RouterLink,
    TableModule,
    SharedModule,
    NgbTooltip,
    NgIf,
    ActionDropdownComponent,
    AdvancedInputFilterComponent,
    ButtonComponent,
    TableExpanderIconComponent,
    NgClass,
    AutoColspanDirective
  ]
})
export class RunnerJobListComponent extends RestTable <RunnerJob> implements OnInit {
  runnerJobs: RunnerJobFormatted[] = []
  totalRecords = 0

  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

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

  constructor (
    private runnerService: RunnerService,
    private notifier: Notifier,
    private confirmService: ConfirmService
  ) {
    super()
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

    this.initialize()
  }

  getIdentifier () {
    return 'RunnerJobListComponent'
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
            this.reloadData()
            this.notifier.success($localize`Job(s) cancelled.`)
          },

          error: err => this.notifier.error(err.message)
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
            this.reloadData()
            this.notifier.success($localize`Job(s) removed.`)
          },

          error: err => this.notifier.error(err.message)
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

  protected reloadDataInternal () {
    this.runnerService.listRunnerJobs({ pagination: this.pagination, sort: this.sort, search: this.search })
      .subscribe({
        next: resultList => {
          this.runnerJobs = resultList.data
          this.totalRecords = resultList.total
        },

        error: err => this.notifier.error(err.message)
      })
  }

  private canCancelJob (job: RunnerJob) {
    return job.state.id === RunnerJobState.PENDING ||
      job.state.id === RunnerJobState.PROCESSING ||
      job.state.id === RunnerJobState.WAITING_FOR_PARENT_JOB
  }
}
