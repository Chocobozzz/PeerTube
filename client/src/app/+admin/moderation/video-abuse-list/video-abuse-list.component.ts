import { Component, OnInit, ViewChild } from '@angular/core'
import { Account } from '../../../shared/account/account.model'
import { NotificationsService } from 'angular2-notifications'
import { SortMeta } from 'primeng/components/common/sortmeta'
import { VideoAbuse, VideoAbuseState } from '../../../../../../shared'
import { RestPagination, RestTable, VideoAbuseService } from '../../../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { DropdownAction } from '../../../shared/buttons/action-dropdown.component'
import { ConfirmService } from '../../../core/index'
import { ModerationCommentModalComponent } from './moderation-comment-modal.component'
import { Video } from '../../../shared/video/video.model'

@Component({
  selector: 'my-video-abuse-list',
  templateUrl: './video-abuse-list.component.html',
  styleUrls: [ './video-abuse-list.component.scss']
})
export class VideoAbuseListComponent extends RestTable implements OnInit {
  @ViewChild('moderationCommentModal') moderationCommentModal: ModerationCommentModalComponent

  videoAbuses: VideoAbuse[] = []
  totalRecords = 0
  rowsPerPage = 10
  sort: SortMeta = { field: 'createdAt', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  videoAbuseActions: DropdownAction<VideoAbuse>[] = []

  constructor (
    private notificationsService: NotificationsService,
    private videoAbuseService: VideoAbuseService,
    private confirmService: ConfirmService,
    private i18n: I18n
  ) {
    super()

    this.videoAbuseActions = [
      {
        label: this.i18n('Delete'),
        handler: videoAbuse => this.removeVideoAbuse(videoAbuse)
      },
      {
        label: this.i18n('Update moderation comment'),
        handler: videoAbuse => this.openModerationCommentModal(videoAbuse)
      },
      {
        label: this.i18n('Mark as accepted'),
        handler: videoAbuse => this.updateVideoAbuseState(videoAbuse, VideoAbuseState.ACCEPTED),
        isDisplayed: videoAbuse => !this.isVideoAbuseAccepted(videoAbuse)
      },
      {
        label: this.i18n('Mark as rejected'),
        handler: videoAbuse => this.updateVideoAbuseState(videoAbuse, VideoAbuseState.REJECTED),
        isDisplayed: videoAbuse => !this.isVideoAbuseRejected(videoAbuse)
      }
    ]
  }

  ngOnInit () {
    this.loadSort()
  }

  openModerationCommentModal (videoAbuse: VideoAbuse) {
    this.moderationCommentModal.openModal(videoAbuse)
  }

  onModerationCommentUpdated () {
    this.loadData()
  }

  createByString (account: Account) {
    return Account.CREATE_BY_STRING(account.name, account.host)
  }

  isVideoAbuseAccepted (videoAbuse: VideoAbuse) {
    return videoAbuse.state.id === VideoAbuseState.ACCEPTED
  }

  isVideoAbuseRejected (videoAbuse: VideoAbuse) {
    return videoAbuse.state.id === VideoAbuseState.REJECTED
  }

  getVideoUrl (videoAbuse: VideoAbuse) {
    return Video.buildClientUrl(videoAbuse.video.uuid)
  }

  async removeVideoAbuse (videoAbuse: VideoAbuse) {
    const res = await this.confirmService.confirm(this.i18n('Do you really want to delete this abuse?'), this.i18n('Delete'))
    if (res === false) return

    this.videoAbuseService.removeVideoAbuse(videoAbuse).subscribe(
      () => {
        this.notificationsService.success(
          this.i18n('Success'),
          this.i18n('Abuse deleted.')
        )
        this.loadData()
      },

      err => this.notificationsService.error(this.i18n('Error'), err.message)
    )
  }

  updateVideoAbuseState (videoAbuse: VideoAbuse, state: VideoAbuseState) {
    this.videoAbuseService.updateVideoAbuse(videoAbuse, { state })
      .subscribe(
        () => this.loadData(),

        err => this.notificationsService.error(this.i18n('Error'), err.message)
      )

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
