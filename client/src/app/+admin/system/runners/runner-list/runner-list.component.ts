import { Component, OnInit } from '@angular/core'
import { ConfirmService, Notifier, RestPagination, RestTable } from '@app/core'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { Runner } from '@peertube/peertube-models'
import { SharedModule, SortMeta } from 'primeng/api'
import { TableModule } from 'primeng/table'
import { ActionDropdownComponent, DropdownAction } from '../../../../shared/shared-main/buttons/action-dropdown.component'
import { AutoColspanDirective } from '../../../../shared/shared-main/common/auto-colspan.directive'
import { RunnerService } from '../runner.service'

@Component({
  selector: 'my-runner-list',
  templateUrl: './runner-list.component.html',
  standalone: true,
  imports: [
    TableModule,
    SharedModule,
    NgbTooltip,
    ActionDropdownComponent,
    AutoColspanDirective,
    PTDatePipe
  ]
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
