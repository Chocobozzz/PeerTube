import { Component, OnInit } from '@angular/core'
import { Notifier } from '@app/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { RestPagination, RestTable } from '@app/shared'
import { SortMeta } from 'primeng/api'
import { AccountBlock, BlocklistService } from '@app/shared/blocklist'
import { Actor } from '@app/shared/actor/actor.model'

@Component({
  selector: 'my-instance-account-blocklist',
  styleUrls: [ '../moderation.component.scss', './instance-account-blocklist.component.scss' ],
  templateUrl: './instance-account-blocklist.component.html'
})
export class InstanceAccountBlocklistComponent extends RestTable implements OnInit {
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
    return 'InstanceAccountBlocklistComponent'
  }

  switchToDefaultAvatar ($event: Event) {
    ($event.target as HTMLImageElement).src = Actor.GET_DEFAULT_AVATAR_URL()
  }

  unblockAccount (accountBlock: AccountBlock) {
    const blockedAccount = accountBlock.blockedAccount

    this.blocklistService.unblockAccountByInstance(blockedAccount)
        .subscribe(
          () => {
            this.notifier.success(
              this.i18n('Account {{nameWithHost}} unmuted by your instance.', { nameWithHost: blockedAccount.nameWithHost })
            )

            this.loadData()
          }
        )
  }

  protected loadData () {
    return this.blocklistService.getInstanceAccountBlocklist({
      pagination: this.pagination,
      sort: this.sort,
      search: this.search
    })
      .subscribe(
        resultList => {
          this.blockedAccounts = resultList.data
          this.totalRecords = resultList.total
        },

        err => this.notifier.error(err.message)
      )
  }
}
