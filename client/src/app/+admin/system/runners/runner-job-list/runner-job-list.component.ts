import { SortMeta } from 'primeng/api'
import { Component, OnInit } from '@angular/core'
import { ConfirmService, Notifier, RestPagination, RestTable } from '@app/core'
import { formatICU } from '@app/helpers'
import { DropdownAction } from '@app/shared/shared-main'
import { RunnerJob, RunnerJobState } from '@shared/models'
import { RunnerJobFormatted, RunnerService } from '../runner.service'

@Component({
  selector: 'my-runner-job-list',
  templateUrl: './runner-job-list.component.html'
})
export class RunnerJobListComponent extends RestTable <RunnerJob> implements OnInit {
  runnerJobs: RunnerJobFormatted[] = []
  totalRecords = 0

  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  actions: DropdownAction<RunnerJob>[][] = []
  bulkActions: DropdownAction<RunnerJob[]>[][] = []

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
      ]
    ]

    this.bulkActions = [
      [
        {
          label: $localize`Cancel`,
          handler: jobs => this.cancelJobs(jobs),
          isDisplayed: jobs => jobs.every(j => this.canCancelJob(j))
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
