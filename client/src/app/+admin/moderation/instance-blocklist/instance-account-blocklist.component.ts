import { Component, OnInit } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { RestPagination, RestTable } from '@app/shared'
import { SortMeta } from 'primeng/components/common/sortmeta'
import { BlocklistService, AccountBlock } from '@app/shared/blocklist'

@Component({
  selector: 'my-instance-account-blocklist',
  styleUrls: [ './instance-account-blocklist.component.scss' ],
  templateUrl: './instance-account-blocklist.component.html'
})
export class InstanceAccountBlocklistComponent extends RestTable implements OnInit {
  blockedAccounts: AccountBlock[] = []
  totalRecords = 0
  rowsPerPage = 10
  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  constructor (
    private notificationsService: NotificationsService,
    private blocklistService: BlocklistService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.initialize()
  }

  unblockAccount (accountBlock: AccountBlock) {
    const blockedAccount = accountBlock.blockedAccount

    this.blocklistService.unblockAccountByInstance(blockedAccount)
        .subscribe(
          () => {
            this.notificationsService.success(
              this.i18n('Success'),
              this.i18n('Account {{nameWithHost}} unmuted by your instance.', { nameWithHost: blockedAccount.nameWithHost })
            )

            this.loadData()
          }
        )
  }

  protected loadData () {
    return this.blocklistService.getInstanceAccountBlocklist(this.pagination, this.sort)
      .subscribe(
        resultList => {
          this.blockedAccounts = resultList.data
          this.totalRecords = resultList.total
        },

        err => this.notificationsService.error(this.i18n('Error'), err.message)
      )
  }
}
