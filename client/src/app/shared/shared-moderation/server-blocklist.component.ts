import { SortMeta } from 'primeng/api'
import { Directive, OnInit, ViewChild } from '@angular/core'
import { Notifier, RestPagination, RestTable } from '@app/core'
import { BatchDomainsModalComponent } from '@app/shared/shared-moderation/batch-domains-modal.component'
import { ServerBlock } from '@shared/models'
import { BlocklistComponentType, BlocklistService } from './blocklist.service'

@Directive()
// tslint:disable-next-line: directive-class-suffix
export class GenericServerBlocklistComponent extends RestTable implements OnInit {
  @ViewChild('batchDomainsModal') batchDomainsModal: BatchDomainsModalComponent

  // @ts-ignore: "Abstract methods can only appear within an abstract class"
  public abstract mode: BlocklistComponentType

  blockedServers: ServerBlock[] = []
  totalRecords = 0
  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  constructor (
    protected notifier: Notifier,
    protected blocklistService: BlocklistService
  ) {
    super()
  }

  // @ts-ignore: "Abstract methods can only appear within an abstract class"
  public abstract getIdentifier (): string

  ngOnInit () {
    this.initialize()
  }

  unblockServer (serverBlock: ServerBlock) {
    const operation = (host: string) => this.mode === BlocklistComponentType.Account
        ? this.blocklistService.unblockServerByUser(host)
        : this.blocklistService.unblockServerByInstance(host)
    const host = serverBlock.blockedServer.host

    operation(host).subscribe(
      () => {
        this.notifier.success(
          this.mode === BlocklistComponentType.Account
            ? $localize`Instance ${host} unmuted.`
            : $localize`Instance ${host} unmuted by your instance.`
        )

        this.reloadData()
      }
    )
  }

  addServersToBlock () {
    this.batchDomainsModal.openModal()
  }

  onDomainsToBlock (domains: string[]) {
    const operation = (domain: string) => this.mode === BlocklistComponentType.Account
      ? this.blocklistService.blockServerByUser(domain)
      : this.blocklistService.blockServerByInstance(domain)

    domains.forEach(domain => {
      operation(domain).subscribe(
        () => {
          this.notifier.success(
            this.mode === BlocklistComponentType.Account
              ? $localize`Instance ${domain} muted.`
              : $localize`Instance ${domain} muted by your instance.`
          )

          this.reloadData()
        }
      )
    })
  }

  protected reloadData () {
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

    return operation.subscribe(
      resultList => {
        this.blockedServers = resultList.data
        this.totalRecords = resultList.total
      },

      err => this.notifier.error(err.message)
    )
  }
}
