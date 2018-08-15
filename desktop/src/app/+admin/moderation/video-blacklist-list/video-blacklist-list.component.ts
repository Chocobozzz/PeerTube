import { Component, OnInit } from '@angular/core'
import { SortMeta } from 'primeng/components/common/sortmeta'
import { NotificationsService } from 'angular2-notifications'
import { ConfirmService } from '../../../core'
import { RestPagination, RestTable, VideoBlacklistService } from '../../../shared'
import { VideoBlacklist } from '../../../../../../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { DropdownAction } from '../../../shared/buttons/action-dropdown.component'
import { Video } from '../../../shared/video/video.model'

@Component({
  selector: 'my-video-blacklist-list',
  templateUrl: './video-blacklist-list.component.html',
  styleUrls: [ './video-blacklist-list.component.scss' ]
})
export class VideoBlacklistListComponent extends RestTable implements OnInit {
  blacklist: VideoBlacklist[] = []
  totalRecords = 0
  rowsPerPage = 10
  sort: SortMeta = { field: 'createdAt', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  videoBlacklistActions: DropdownAction<VideoBlacklist>[] = []

  constructor (
    private notificationsService: NotificationsService,
    private confirmService: ConfirmService,
    private videoBlacklistService: VideoBlacklistService,
    private i18n: I18n
  ) {
    super()

    this.videoBlacklistActions = [
      {
        label: this.i18n('Unblacklist'),
        handler: videoBlacklist => this.removeVideoFromBlacklist(videoBlacklist)
      }
    ]
  }

  ngOnInit () {
    this.loadSort()
  }

  getVideoUrl (videoBlacklist: VideoBlacklist) {
    return Video.buildClientUrl(videoBlacklist.video.uuid)
  }

  async removeVideoFromBlacklist (entry: VideoBlacklist) {
    const confirmMessage = this.i18n(
      'Do you really want to remove this video from the blacklist? It will be available again in the videos list.'
    )

    const res = await this.confirmService.confirm(confirmMessage, this.i18n('Unblacklist'))
    if (res === false) return

    this.videoBlacklistService.removeVideoFromBlacklist(entry.video.id).subscribe(
      () => {
        this.notificationsService.success(
          this.i18n('Success'),
          this.i18n('Video {{name}} removed from the blacklist.', { name: entry.video.name })
        )
        this.loadData()
      },

      err => this.notificationsService.error(this.i18n('Error'), err.message)
    )
  }

  protected loadData () {
    this.videoBlacklistService.listBlacklist(this.pagination, this.sort)
      .subscribe(
        resultList => {
          this.blacklist = resultList.data
          this.totalRecords = resultList.total
        },

        err => this.notificationsService.error(this.i18n('Error'), err.message)
      )
  }
}
