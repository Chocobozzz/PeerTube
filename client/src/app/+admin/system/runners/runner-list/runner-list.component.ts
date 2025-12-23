import { Component, OnInit, inject, viewChild } from '@angular/core'
import { ConfirmService, Notifier } from '@app/core'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { Runner } from '@peertube/peertube-models'
import { ActionDropdownComponent, DropdownAction } from '../../../../shared/shared-main/buttons/action-dropdown.component'
import { NumberFormatterPipe } from '../../../../shared/shared-main/common/number-formatter.pipe'
import { DataLoaderOptions, TableColumnInfo, TableComponent } from '../../../../shared/shared-tables/table.component'
import { RunnerService } from '../runner.service'

@Component({
  selector: 'my-runner-list',
  templateUrl: './runner-list.component.html',
  imports: [
    ActionDropdownComponent,
    PTDatePipe,
    TableComponent,
    NumberFormatterPipe
  ]
})
export class RunnerListComponent implements OnInit {
  private runnerService = inject(RunnerService)
  private notifier = inject(Notifier)
  private confirmService = inject(ConfirmService)

  readonly table = viewChild<TableComponent<Runner>>('table')

  actions: DropdownAction<Runner>[][] = []

  columns: TableColumnInfo<string>[] = [
    { id: 'name', label: $localize`Name`, sortable: false },
    { id: 'description', label: $localize`Description`, sortable: false },
    { id: 'ip', label: $localize`IP`, sortable: false },
    { id: 'version', label: $localize`Version`, sortable: false },
    { id: 'lastContact', label: $localize`Last contact`, sortable: false },
    { id: 'createdAt', label: $localize`Created`, sortable: true }
  ]

  dataLoader: typeof this._dataLoader

  constructor () {
    this.dataLoader = this._dataLoader.bind(this)
  }

  ngOnInit () {
    this.actions = [
      [
        {
          label: $localize`Remove`,
          handler: runner => this.deleteRunner(runner)
        }
      ]
    ]
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
          this.table().loadData()
          this.notifier.success($localize`Runner removed.`)
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private _dataLoader (options: DataLoaderOptions) {
    return this.runnerService.listRunners(options)
  }
}
