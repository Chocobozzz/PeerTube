import { Component, OnInit } from '@angular/core'
import { RouterLink } from '@angular/router'
import { ConfirmService, Notifier, RestPagination, RestTable } from '@app/core'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { RunnerRegistrationToken } from '@peertube/peertube-models'
import { SharedModule, SortMeta } from 'primeng/api'
import { TableModule } from 'primeng/table'
import { GlobalIconComponent } from '../../../../shared/shared-icons/global-icon.component'
import { ActionDropdownComponent, DropdownAction } from '../../../../shared/shared-main/buttons/action-dropdown.component'
import { ButtonComponent } from '../../../../shared/shared-main/buttons/button.component'
import { CopyButtonComponent } from '../../../../shared/shared-main/buttons/copy-button.component'
import { AutoColspanDirective } from '../../../../shared/shared-main/common/auto-colspan.directive'
import { RunnerService } from '../runner.service'

@Component({
  selector: 'my-runner-registration-token-list',
  styleUrls: [ './runner-registration-token-list.component.scss' ],
  templateUrl: './runner-registration-token-list.component.html',
  standalone: true,
  imports: [
    GlobalIconComponent,
    RouterLink,
    TableModule,
    SharedModule,
    NgbTooltip,
    ButtonComponent,
    ActionDropdownComponent,
    CopyButtonComponent,
    AutoColspanDirective,
    PTDatePipe
  ]
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
