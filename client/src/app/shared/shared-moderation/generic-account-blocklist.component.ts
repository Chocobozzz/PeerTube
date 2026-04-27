import { Component, inject, input, viewChild } from '@angular/core'
import { AdvancedFilterDef } from '@app/shared/shared-forms/advanced-input-filter.component'
import { Notifier } from '@app/core'
import { RouterLink } from '@angular/router'
import { ActorAvatarComponent } from '../shared-actor-image/actor-avatar.component'
import { PTDatePipe } from '../shared-main/common/date.pipe'
import { NumberFormatterPipe } from '../shared-main/common/number-formatter.pipe'
import { PeerTubeBadgeService } from '../shared-main/common/peertube-badge.service'
import { DataLoaderOptionsBase, TableColumnInfo, TableComponent } from '../shared-tables/table.component'
import { AccountBlock } from './account-block.model'
import { BlocklistComponentType, BlocklistService } from './blocklist.service'

type DataLoaderParameter = DataLoaderOptionsBase & {
  subscriptionName?: string
}

@Component({
  selector: 'my-generic-account-blocklist',
  templateUrl: './generic-account-blocklist.component.html',
  imports: [
    TableComponent,
    NumberFormatterPipe,
    ActorAvatarComponent,
    PTDatePipe,
    RouterLink
  ]
})
export class GenericAccountBlocklistComponent {
  private notifier = inject(Notifier)
  private badgeService = inject(PeerTubeBadgeService)
  private blocklistService = inject(BlocklistService)

  readonly mode = input.required<BlocklistComponentType>()
  readonly key = input.required<string>()

  readonly table = viewChild<TableComponent<AccountBlock, DataLoaderParameter>>('table')

  readonly inputFilters: AdvancedFilterDef<DataLoaderParameter>[] = [
    {
      key: 'subscriptionName',
      type: 'text',
      title: $localize`Subscription list name`,
      placeholder: $localize`Filter by subscription name`
    }
  ]

  columns: TableColumnInfo<string>[] = [
    { id: 'account', label: $localize`Account`, sortable: false },
    { id: 'createdAt', label: $localize`Muted at`, sortable: true },
    {
      id: 'subscriptionName',
      label: $localize`Subscription list name`,
      sortable: false,
      isDisplayed: () => this.mode() === BlocklistComponentType.Instance
    }
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

  getSubscriptionBadge (name: string) {
    return this.badgeService.getRandomBadge('subscription', name)
  }

  isInstanceMode () {
    return this.mode() === BlocklistComponentType.Instance
  }

  getBlocklistUrl () {
    return '/admin/moderation/blocklist/accounts'
  }

  private _dataLoader (options: DataLoaderParameter) {
    if (this.mode() === BlocklistComponentType.Account) {
      return this.blocklistService.listUserAccountBlocklist(options)
    }

    return this.blocklistService.listInstanceAccountBlocklist(options)
  }
}
