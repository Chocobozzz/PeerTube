import { Component, OnInit } from '@angular/core'
import { Notifier } from '@app/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { RestPagination, RestTable } from '@app/shared'
import { SortMeta } from 'primeng/api'
import { AccountBlock, BlocklistService } from '@app/shared/blocklist'

@Component({
  selector: 'my-account-blocklist',
  styleUrls: [ './my-account-blocklist.component.scss' ],
  templateUrl: './my-account-blocklist.component.html'
})
export class MyAccountBlocklistComponent extends RestTable implements OnInit {
  blockedAccounts: AccountBlock[] = []
  totalRecords = 0
  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  constructor (
    private notifier: Notifier,
    private blocklistService: BlocklistService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.initialize()
  }

  getIdentifier () {
    return 'MyAccountBlocklistComponent'
  }

  unblockAccount (accountBlock: AccountBlock) {
    const blockedAccount = accountBlock.blockedAccount

    this.blocklistService.unblockAccountByUser(blockedAccount)
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Account {{nameWithHost}} unmuted.', { nameWithHost: blockedAccount.nameWithHost }))

            this.loadData()
          }
        )
  }

  protected loadData () {
    return this.blocklistService.getUserAccountBlocklist(this.pagination, this.sort)
      .subscribe(
        resultList => {
          this.blockedAccounts = resultList.data
          this.totalRecords = resultList.total
        },

        err => this.notifier.error(err.message)
      )
  }
}
