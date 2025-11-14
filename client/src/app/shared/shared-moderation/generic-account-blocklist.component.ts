import { Component, inject, input, viewChild } from '@angular/core'
import { Notifier } from '@app/core'
import { ActorAvatarComponent } from '../shared-actor-image/actor-avatar.component'
import { AdvancedInputFilterComponent } from '../shared-forms/advanced-input-filter.component'
import { PTDatePipe } from '../shared-main/common/date.pipe'
import { NumberFormatterPipe } from '../shared-main/common/number-formatter.pipe'
import { DataLoaderOptions, TableColumnInfo, TableComponent } from '../shared-tables/table.component'
import { AccountBlock } from './account-block.model'
import { BlocklistComponentType, BlocklistService } from './blocklist.service'

@Component({
  selector: 'my-generic-account-blocklist',
  templateUrl: './generic-account-blocklist.component.html',
  imports: [
    TableComponent,
    NumberFormatterPipe,
    AdvancedInputFilterComponent,
    ActorAvatarComponent,
    PTDatePipe
  ]
})
export class GenericAccountBlocklistComponent {
  private notifier = inject(Notifier)
  private blocklistService = inject(BlocklistService)

  readonly mode = input.required<BlocklistComponentType>()
  readonly key = input.required<string>()

  readonly table = viewChild<TableComponent<AccountBlock>>('table')

  columns: TableColumnInfo<string>[] = [
    { id: 'account', label: $localize`Account`, sortable: false },
    { id: 'createdAt', label: $localize`Muted at`, sortable: true }
  ]

  dataLoader: typeof this._dataLoader

  constructor () {
    this.dataLoader = this._dataLoader.bind(this)
  }

  unblockAccount (accountBlock: AccountBlock) {
    const blockedAccount = accountBlock.blockedAccount

    const operation = this.mode() === BlocklistComponentType.Account
      ? this.blocklistService.unblockAccountByUser(blockedAccount)
      : this.blocklistService.unblockAccountByInstance(blockedAccount)

    operation.subscribe(
      () => {
        this.notifier.success(
          this.mode() === BlocklistComponentType.Account
            ? $localize`Account ${blockedAccount.nameWithHost} unmuted.`
            : $localize`Account ${blockedAccount.nameWithHost} unmuted by your platform.`
        )

        this.table().loadData()
      }
    )
  }

  private _dataLoader (options: DataLoaderOptions) {
    if (this.mode() === BlocklistComponentType.Account) {
      return this.blocklistService.getUserAccountBlocklist(options)
    }

    return this.blocklistService.getInstanceAccountBlocklist(options)
  }
}
