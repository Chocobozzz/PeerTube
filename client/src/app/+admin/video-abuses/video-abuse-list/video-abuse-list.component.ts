import { Component, OnInit } from '@angular/core'
import { Account } from '@app/shared/account/account.model'
import { NotificationsService } from 'angular2-notifications'
import { SortMeta } from 'primeng/components/common/sortmeta'
import { VideoAbuse } from '../../../../../../shared'

import { RestPagination, RestTable, VideoAbuseService } from '../../../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-video-abuse-list',
  templateUrl: './video-abuse-list.component.html',
  styleUrls: [ './video-abuse-list.component.scss']
})
export class VideoAbuseListComponent extends RestTable implements OnInit {
  videoAbuses: VideoAbuse[] = []
  totalRecords = 0
  rowsPerPage = 10
  sort: SortMeta = { field: 'createdAt', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  constructor (
    private notificationsService: NotificationsService,
    private videoAbuseService: VideoAbuseService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.loadSort()
  }

  createByString (account: Account) {
    return Account.CREATE_BY_STRING(account.name, account.host)
  }

  protected loadData () {
    return this.videoAbuseService.getVideoAbuses(this.pagination, this.sort)
               .subscribe(
                 resultList => {
                   this.videoAbuses = resultList.data
                   this.totalRecords = resultList.total
                 },

                 err => this.notificationsService.error(this.i18n('Error'), err.message)
               )
  }
}
