import { SortMeta } from 'primeng/api'
import { Component, OnInit } from '@angular/core'
import { ConfirmService, Notifier, RestPagination, RestTable } from '@app/core'
import { DropdownAction } from '@app/shared/shared-main'
import { RunnerJob } from '@shared/models'
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
          handler: job => this.cancelJob(job)
        }
      ]
    ]

    this.initialize()
  }

  getIdentifier () {
    return 'RunnerJobListComponent'
  }

  async cancelJob (job: RunnerJob) {
    const res = await this.confirmService.confirm(
      $localize`Do you really want to cancel this job? Children won't be processed.`,
      $localize`Cancel job`
    )

    if (res === false) return

    this.runnerService.cancelJob(job)
        .subscribe({
          next: () => {
            this.reloadData()
            this.notifier.success($localize`Job cancelled.`)
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
}
