import { Component, inject, input, viewChild, ChangeDetectionStrategy } from '@angular/core'
import { Notifier } from '@app/core'
import { RouterLink } from '@angular/router'
import { AdvancedFilterDef } from '@app/shared/shared-forms/advanced-input-filter.component'
import { BatchDomainsModalComponent } from '@app/shared/shared-moderation/batch-domains-modal.component'
import { ServerBlock } from '@peertube/peertube-models'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { PTDatePipe } from '../shared-main/common/date.pipe'
import { NumberFormatterPipe } from '../shared-main/common/number-formatter.pipe'
import { PeerTubeBadgeService } from '../shared-main/common/peertube-badge.service'
import { DataLoaderOptionsBase, TableColumnInfo, TableComponent } from '../shared-tables/table.component'
import { BlocklistComponentType, BlocklistService } from './blocklist.service'

type DataLoaderParameter = DataLoaderOptionsBase & {
  subscriptionName?: string
}

@Component({
  selector: 'my-generic-server-blocklist',
  templateUrl: './generic-server-blocklist.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    TableComponent,
    NumberFormatterPipe,
    PTDatePipe,
    GlobalIconComponent,
    BatchDomainsModalComponent,
    RouterLink
  ]
})
export class GenericServerBlocklistComponent {
  private notifier = inject(Notifier)
  private badgeService = inject(PeerTubeBadgeService)
  private blocklistService = inject(BlocklistService)

  readonly mode = input.required<BlocklistComponentType>()
  readonly key = input.required<string>()

  readonly batchDomainsModal = viewChild<BatchDomainsModalComponent>('batchDomainsModal')
  readonly table = viewChild<TableComponent<ServerBlock, DataLoaderParameter>>('table')

  readonly inputFilters: AdvancedFilterDef<DataLoaderParameter>[] = [
    {
      key: 'subscriptionName',
      type: 'text',
      title: $localize`Subscription list name`,
      placeholder: $localize`Filter by subscription name`
    }
  ]

  columns: TableColumnInfo<string>[] = [
    { id: 'server', label: $localize`Server`, sortable: false },
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

  unblockServer (serverBlock: ServerBlock) {
    const operation = (host: string) =>
      this.mode() === BlocklistComponentType.Account
        ? this.blocklistService.unblockServerByUser(host)
        : this.blocklistService.unblockServerByInstance(host)
    const host = serverBlock.blockedServer.host

    operation(host).subscribe(
      () => {
        this.notifier.success(
          this.mode() === BlocklistComponentType.Account
            ? $localize`${host} unmuted.`
            : $localize`${host} unmuted by your platform.`
        )

        this.table().loadData()
      }
    )
  }

  addServersToBlock () {
    this.batchDomainsModal().openModal()
  }

  onDomainsToBlock (domains: string[]) {
    const operation = (domain: string) =>
      this.mode() === BlocklistComponentType.Account
        ? this.blocklistService.blockServerByUser(domain)
        : this.blocklistService.blockServerByInstance(domain)

    domains.forEach(domain => {
      operation(domain).subscribe(
        () => {
          this.notifier.success(
            this.mode() === BlocklistComponentType.Account
              ? $localize`Platform ${domain} muted.`
              : $localize`Platform ${domain} muted by your platform.`
          )

          this.table().loadData()
        }
      )
    })
  }

  getSubscriptionBadge (name: string) {
    return this.badgeService.getRandomBadge('subscription', name)
  }

  getBlocklistUrl () {
    return '/admin/moderation/blocklist/servers'
  }

  isInstanceMode () {
    return this.mode() === BlocklistComponentType.Instance
  }

  private _dataLoader (options: DataLoaderParameter) {
    if (this.mode() === BlocklistComponentType.Account) {
      return this.blocklistService.listUserServerBlocklist(options)
    }

    return this.blocklistService.listInstanceServerBlocklist(options)
  }
}
