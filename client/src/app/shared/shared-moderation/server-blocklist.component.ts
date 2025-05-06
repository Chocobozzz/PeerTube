import { Directive, OnInit, inject, viewChild } from '@angular/core'
import { Notifier, RestPagination, RestTable } from '@app/core'
import { BatchDomainsModalComponent } from '@app/shared/shared-moderation/batch-domains-modal.component'
import { ServerBlock } from '@peertube/peertube-models'
import { SortMeta } from 'primeng/api'
import { BlocklistComponentType, BlocklistService } from './blocklist.service'

@Directive()
export class GenericServerBlocklistComponent extends RestTable implements OnInit {
  protected notifier = inject(Notifier)
  protected blocklistService = inject(BlocklistService)

  readonly batchDomainsModal = viewChild<BatchDomainsModalComponent>('batchDomainsModal')

  // @ts-expect-error: "Abstract methods can only appear within an abstract class"
  public abstract mode: BlocklistComponentType

  blockedServers: ServerBlock[] = []
  totalRecords = 0
  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  // @ts-expect-error: "Abstract methods can only appear within an abstract class"
  public abstract getIdentifier (): string

  ngOnInit () {
    this.initialize()
  }

  unblockServer (serverBlock: ServerBlock) {
    const operation = (host: string) =>
      this.mode === BlocklistComponentType.Account
        ? this.blocklistService.unblockServerByUser(host)
        : this.blocklistService.unblockServerByInstance(host)
    const host = serverBlock.blockedServer.host

    operation(host).subscribe(
      () => {
        this.notifier.success(
          this.mode === BlocklistComponentType.Account
            ? $localize`${host} unmuted.`
            : $localize`${host} unmuted by your platform.`
        )

        this.reloadData()
      }
    )
  }

  addServersToBlock () {
    this.batchDomainsModal().openModal()
  }

  onDomainsToBlock (domains: string[]) {
    const operation = (domain: string) =>
      this.mode === BlocklistComponentType.Account
        ? this.blocklistService.blockServerByUser(domain)
        : this.blocklistService.blockServerByInstance(domain)

    domains.forEach(domain => {
      operation(domain).subscribe(
        () => {
          this.notifier.success(
            this.mode === BlocklistComponentType.Account
              ? $localize`Platform ${domain} muted.`
              : $localize`Platform ${domain} muted by your platform.`
          )

          this.reloadData()
        }
      )
    })
  }

  protected reloadDataInternal () {
    const operation = this.mode === BlocklistComponentType.Account
      ? this.blocklistService.getUserServerBlocklist({
        pagination: this.pagination,
        sort: this.sort,
        search: this.search
      })
      : this.blocklistService.getInstanceServerBlocklist({
        pagination: this.pagination,
        sort: this.sort,
        search: this.search
      })

    return operation.subscribe({
      next: resultList => {
        this.blockedServers = resultList.data
        this.totalRecords = resultList.total
      },

      error: err => this.notifier.error(err.message)
    })
  }
}
