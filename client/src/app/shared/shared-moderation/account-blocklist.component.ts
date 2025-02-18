import { SortMeta } from 'primeng/api'
import { Directive, OnInit } from '@angular/core'
import { Notifier, RestPagination, RestTable } from '@app/core'
import { AccountBlock } from './account-block.model'
import { BlocklistComponentType, BlocklistService } from './blocklist.service'

@Directive()
// eslint-disable-next-line @angular-eslint/directive-class-suffix
export class GenericAccountBlocklistComponent extends RestTable implements OnInit {
  // @ts-expect-error: "Abstract methods can only appear within an abstract class"
  abstract mode: BlocklistComponentType

  blockedAccounts: AccountBlock[] = []
  totalRecords = 0
  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  constructor (
    private notifier: Notifier,
    private blocklistService: BlocklistService
  ) {
    super()
  }

  // @ts-expect-error: "Abstract methods can only appear within an abstract class"
  abstract getIdentifier (): string

  ngOnInit () {
    this.initialize()
  }

  unblockAccount (accountBlock: AccountBlock) {
    const blockedAccount = accountBlock.blockedAccount
    const operation = this.mode === BlocklistComponentType.Account
      ? this.blocklistService.unblockAccountByUser(blockedAccount)
      : this.blocklistService.unblockAccountByInstance(blockedAccount)

    operation.subscribe(
      () => {
        this.notifier.success(
          this.mode === BlocklistComponentType.Account
            ? $localize`Account ${blockedAccount.nameWithHost} unmuted.`
            : $localize`Account ${blockedAccount.nameWithHost} unmuted by your platform.`
        )

        this.reloadData()
      }
    )
  }

  protected reloadDataInternal () {
    const operation = this.mode === BlocklistComponentType.Account
      ? this.blocklistService.getUserAccountBlocklist({
        pagination: this.pagination,
        sort: this.sort,
        search: this.search
      })
      : this.blocklistService.getInstanceAccountBlocklist({
        pagination: this.pagination,
        sort: this.sort,
        search: this.search
      })

    return operation.subscribe({
      next: resultList => {
        this.blockedAccounts = resultList.data
        this.totalRecords = resultList.total
      },

      error: err => this.notifier.error(err.message)
    })
  }
}
