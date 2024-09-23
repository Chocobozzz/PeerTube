import { SortMeta, SharedModule } from 'primeng/api'
import { Component, OnInit } from '@angular/core'
import { ConfirmService, Notifier, RestPagination, RestTable } from '@app/core'
import { Runner } from '@peertube/peertube-models'
import { RunnerService } from '../runner.service'
import { DatePipe } from '@angular/common'
import { AutoColspanDirective } from '../../../../shared/shared-main/common/auto-colspan.directive'
import { ActionDropdownComponent, DropdownAction } from '../../../../shared/shared-main/buttons/action-dropdown.component'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { TableModule } from 'primeng/table'
import { RouterLink } from '@angular/router'
import { GlobalIconComponent } from '../../../../shared/shared-icons/global-icon.component'

@Component({
  selector: 'my-runner-list',
  templateUrl: './runner-list.component.html',
  standalone: true,
  imports: [
    GlobalIconComponent,
    RouterLink,
    TableModule,
    SharedModule,
    NgbTooltip,
    ActionDropdownComponent,
    AutoColspanDirective,
    DatePipe
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
