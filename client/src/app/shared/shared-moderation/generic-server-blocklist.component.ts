import { Component, inject, input, viewChild } from '@angular/core'
import { Notifier } from '@app/core'
import { BatchDomainsModalComponent } from '@app/shared/shared-moderation/batch-domains-modal.component'
import { ServerBlock } from '@peertube/peertube-models'
import { AdvancedInputFilterComponent } from '../shared-forms/advanced-input-filter.component'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { PTDatePipe } from '../shared-main/common/date.pipe'
import { NumberFormatterPipe } from '../shared-main/common/number-formatter.pipe'
import { DataLoaderOptions, TableColumnInfo, TableComponent } from '../shared-tables/table.component'
import { BlocklistComponentType, BlocklistService } from './blocklist.service'

@Component({
  selector: 'my-generic-server-blocklist',
  templateUrl: './generic-server-blocklist.component.html',
  imports: [
    TableComponent,
    NumberFormatterPipe,
    AdvancedInputFilterComponent,
    PTDatePipe,
    GlobalIconComponent,
    BatchDomainsModalComponent
  ]
})
export class GenericServerBlocklistComponent {
  private notifier = inject(Notifier)
  private blocklistService = inject(BlocklistService)

  readonly mode = input.required<BlocklistComponentType>()
  readonly key = input.required<string>()

  readonly batchDomainsModal = viewChild<BatchDomainsModalComponent>('batchDomainsModal')
  readonly table = viewChild<TableComponent<ServerBlock>>('table')

  columns: TableColumnInfo<string>[] = [
    { id: 'server', label: $localize`Server`, sortable: false },
    { id: 'createdAt', label: $localize`Muted at`, sortable: true }
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

  private _dataLoader (options: DataLoaderOptions) {
    if (this.mode() === BlocklistComponentType.Account) {
      return this.blocklistService.getUserServerBlocklist(options)
    }

    return this.blocklistService.getInstanceServerBlocklist(options)
  }
}
