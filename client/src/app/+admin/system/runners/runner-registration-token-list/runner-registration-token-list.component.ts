import { SortMeta } from 'primeng/api'
import { Component, OnInit } from '@angular/core'
import { ConfirmService, Notifier, RestPagination, RestTable } from '@app/core'
import { DropdownAction } from '@app/shared/shared-main'
import { RunnerRegistrationToken } from '@shared/models'
import { RunnerService } from '../runner.service'

@Component({
  selector: 'my-runner-registration-token-list',
  templateUrl: './runner-registration-token-list.component.html'
})
export class RunnerRegistrationTokenListComponent extends RestTable <RunnerRegistrationToken> implements OnInit {
  registrationTokens: RunnerRegistrationToken[] = []
  totalRecords = 0

  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  actions: DropdownAction<RunnerRegistrationToken>[][] = []

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
          label: $localize`Remove this token`,
          handler: token => this.removeToken(token)
        }
      ]
    ]

    this.initialize()
  }

  getIdentifier () {
    return 'RunnerRegistrationTokenListComponent'
  }

  generateToken () {
    this.runnerService.generateToken()
      .subscribe({
        next: () => {
          this.reloadData()
          this.notifier.success($localize`Registration token generated.`)
        },

        error: err => this.notifier.error(err.message)
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
            this.reloadData()
            this.notifier.success($localize`Registration token removed.`)
          },

          error: err => this.notifier.error(err.message)
        })
  }

  protected reloadDataInternal () {
    this.runnerService.listRegistrationTokens({ pagination: this.pagination, sort: this.sort })
      .subscribe({
        next: resultList => {
          this.registrationTokens = resultList.data
          this.totalRecords = resultList.total
        },

        error: err => this.notifier.error(err.message)
      })
  }
}
