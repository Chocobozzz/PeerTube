import { Component, OnInit } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { RestPagination, RestTable } from '@app/shared'
import { SortMeta } from 'primeng/components/common/sortmeta'
import { ServerBlock } from '../../../../../shared'
import { BlocklistService } from '@app/shared/blocklist'

@Component({
  selector: 'my-account-server-blocklist',
  styleUrls: [ './my-account-server-blocklist.component.scss' ],
  templateUrl: './my-account-server-blocklist.component.html'
})
export class MyAccountServerBlocklistComponent extends RestTable implements OnInit {
  blockedServers: ServerBlock[] = []
  totalRecords = 0
  rowsPerPage = 10
  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  constructor (
    private notificationsService: NotificationsService,
    private blocklistService: BlocklistService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.initialize()
  }

  unblockServer (serverBlock: ServerBlock) {
    const host = serverBlock.blockedServer.host

    this.blocklistService.unblockServerByUser(host)
      .subscribe(
        () => {
          this.notificationsService.success(
            this.i18n('Success'),
            this.i18n('Instance {{host}} unmuted.', { host })
          )

          this.loadData()
        }
      )
  }

  protected loadData () {
    return this.blocklistService.getUserServerBlocklist(this.pagination, this.sort)
      .subscribe(
        resultList => {
          this.blockedServers = resultList.data
          this.totalRecords = resultList.total
        },

        err => this.notificationsService.error(this.i18n('Error'), err.message)
      )
  }
}
