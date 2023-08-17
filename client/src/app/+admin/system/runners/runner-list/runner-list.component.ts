import { SortMeta } from 'primeng/api'
import { Component, OnInit } from '@angular/core'
import { ConfirmService, Notifier, RestPagination, RestTable } from '@app/core'
import { DropdownAction } from '@app/shared/shared-main'
import { Runner } from '@peertube/peertube-models'
import { RunnerService } from '../runner.service'

@Component({
  selector: 'my-runner-list',
  templateUrl: './runner-list.component.html'
})
export class RunnerListComponent extends RestTable <Runner> implements OnInit {
  runners: Runner[] = []
  totalRecords = 0

  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  actions: DropdownAction<Runner>[][] = []

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
          label: $localize`Remove`,
          handler: runer => this.deleteRunner(runer)
        }
      ]
    ]

    this.initialize()
  }

  getIdentifier () {
    return 'RunnerListComponent'
  }

  async deleteRunner (runner: Runner) {
    const res = await this.confirmService.confirm(
      $localize`Do you really want to delete this runner? It won't be able to process jobs anymore.`,
      $localize`Remove ${runner.name}`
    )

    if (res === false) return

    this.runnerService.deleteRunner(runner)
        .subscribe({
          next: () => {
            this.reloadData()
            this.notifier.success($localize`Runner removed.`)
          },

          error: err => this.notifier.error(err.message)
        })
  }

  protected reloadDataInternal () {
    this.runnerService.listRunners({ pagination: this.pagination, sort: this.sort })
      .subscribe({
        next: resultList => {
          this.runners = resultList.data
          this.totalRecords = resultList.total
        },

        error: err => this.notifier.error(err.message)
      })
  }
}
