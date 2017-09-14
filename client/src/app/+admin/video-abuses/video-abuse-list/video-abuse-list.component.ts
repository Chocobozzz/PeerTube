import { Component, OnInit } from '@angular/core'

import { NotificationsService } from 'angular2-notifications'
import { SortMeta } from 'primeng/components/common/sortmeta'

import { RestTable, RestPagination, VideoAbuseService } from '../../../shared'
import { VideoAbuse } from '../../../../../../shared'

@Component({
  selector: 'my-video-abuse-list',
  templateUrl: './video-abuse-list.component.html'
})
export class VideoAbuseListComponent extends RestTable implements OnInit {
  videoAbuses: VideoAbuse[] = []
  totalRecords = 0
  rowsPerPage = 10
  sort: SortMeta = { field: 'id', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  constructor (
    private notificationsService: NotificationsService,
    private videoAbuseService: VideoAbuseService
  ) {
    super()
  }

  ngOnInit () {
    this.loadData()
  }

  getRouterVideoLink (videoId: number) {
    return [ '/videos', videoId ]
  }

  protected loadData () {
    return this.videoAbuseService.getVideoAbuses(this.pagination, this.sort)
               .subscribe(
                 resultList => {
                   this.videoAbuses = resultList.data
                   this.totalRecords = resultList.total
                 },

                 err => this.notificationsService.error('Error', err.message)
               )
  }
}
