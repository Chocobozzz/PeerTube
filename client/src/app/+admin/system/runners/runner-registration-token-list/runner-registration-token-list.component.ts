import { Component, OnInit, inject, viewChild } from '@angular/core'
import { ConfirmService, Notifier } from '@app/core'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { RunnerRegistrationToken } from '@peertube/peertube-models'
import { ActionDropdownComponent, DropdownAction } from '../../../../shared/shared-main/buttons/action-dropdown.component'
import { ButtonComponent } from '../../../../shared/shared-main/buttons/button.component'
import { CopyButtonComponent } from '../../../../shared/shared-main/buttons/copy-button.component'
import { NumberFormatterPipe } from '../../../../shared/shared-main/common/number-formatter.pipe'
import { DataLoaderOptions, TableColumnInfo, TableComponent } from '../../../../shared/shared-tables/table.component'
import { RunnerService } from '../runner.service'

@Component({
  selector: 'my-runner-registration-token-list',
  styleUrls: [ './runner-registration-token-list.component.scss' ],
  templateUrl: './runner-registration-token-list.component.html',
  imports: [
    ButtonComponent,
    ActionDropdownComponent,
    CopyButtonComponent,
    PTDatePipe,
    NumberFormatterPipe,
    TableComponent
  ]
})
export class RunnerRegistrationTokenListComponent implements OnInit {
  private runnerService = inject(RunnerService)
  private notifier = inject(Notifier)
  private confirmService = inject(ConfirmService)

  readonly table = viewChild<TableComponent<RunnerRegistrationToken>>('table')

  actions: DropdownAction<RunnerRegistrationToken>[][] = []

  columns: TableColumnInfo<string>[] = [
    { id: 'token', label: $localize`Token`, sortable: false },
    { id: 'createdAt', label: $localize`Created`, sortable: true },
    { id: 'runners', label: $localize`Associated runners`, sortable: false }
  ]

  dataLoader: typeof this._dataLoader

  constructor () {
    this.dataLoader = this._dataLoader.bind(this)
  }

  ngOnInit () {
    this.actions = [
      [
        {
          label: $localize`Remove this token`,
          handler: token => this.removeToken(token)
        }
      ]
    ]
  }

  generateToken () {
    this.runnerService.generateToken()
      .subscribe({
        next: () => {
          this.table().loadData()
          this.notifier.success($localize`Registration token generated.`)
        },

        error: err => this.notifier.handleError(err)
      })
  }

  async removeToken (token: RunnerRegistrationToken) {
    const res = await this.confirmService.confirm(
      $localize`Do you really want to remove this registration token? All associated runners will also be removed.`,
      $localize`Remove registration token`
    )

    if (res === false) return

    this.runnerService.removeToken(token)
      .subscribe({
        next: () => {
          this.table().loadData()
          this.notifier.success($localize`Registration token removed.`)
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private _dataLoader (options: DataLoaderOptions) {
    return this.runnerService.listRegistrationTokens(options)
  }
}
