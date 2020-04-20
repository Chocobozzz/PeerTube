import { Component, OnInit, ViewChild } from '@angular/core'
import { Notifier } from '@app/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { RestPagination, RestTable } from '@app/shared'
import { SortMeta } from 'primeng/api'
import { BlocklistService } from '@app/shared/blocklist'
import { ServerBlock } from '../../../../../../shared'
import { BatchDomainsModalComponent } from '@app/+admin/config/shared/batch-domains-modal.component'

@Component({
  selector: 'my-instance-server-blocklist',
  styleUrls: [ '../moderation.component.scss', './instance-server-blocklist.component.scss' ],
  templateUrl: './instance-server-blocklist.component.html'
})
export class InstanceServerBlocklistComponent extends RestTable implements OnInit {
  @ViewChild('batchDomainsModal') batchDomainsModal: BatchDomainsModalComponent

  blockedServers: ServerBlock[] = []
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
    return 'InstanceServerBlocklistComponent'
  }

  unblockServer (serverBlock: ServerBlock) {
    const host = serverBlock.blockedServer.host

    this.blocklistService.unblockServerByInstance(host)
      .subscribe(
        () => {
          this.notifier.success(this.i18n('Instance {{host}} unmuted by your instance.', { host }))

          this.loadData()
        }
      )
  }

  addServersToBlock () {
    this.batchDomainsModal.openModal()
  }

  onDomainsToBlock (domains: string[]) {
    domains.forEach(domain => {
      this.blocklistService.blockServerByInstance(domain)
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Instance {{domain}} muted by your instance.', { domain }))

            this.loadData()
          }
        )
    })
  }

  protected loadData () {
    return this.blocklistService.getInstanceServerBlocklist({
      pagination: this.pagination,
      sort: this.sort,
      search: this.search
    })
      .subscribe(
        resultList => {
          this.blockedServers = resultList.data
          this.totalRecords = resultList.total
        },

        err => this.notifier.error(err.message)
      )
  }
}
