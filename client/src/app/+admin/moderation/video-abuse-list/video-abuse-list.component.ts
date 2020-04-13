import { Component, OnInit, ViewChild } from '@angular/core'
import { Account } from '../../../shared/account/account.model'
import { Notifier } from '@app/core'
import { SortMeta } from 'primeng/api'
import { VideoAbuse, VideoAbuseState } from '../../../../../../shared'
import { RestPagination, RestTable, VideoAbuseService } from '../../../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { DropdownAction } from '../../../shared/buttons/action-dropdown.component'
import { ConfirmService } from '../../../core/index'
import { ModerationCommentModalComponent } from './moderation-comment-modal.component'
import { Video } from '../../../shared/video/video.model'
import { MarkdownService } from '@app/shared/renderer'
import { Actor } from '@app/shared/actor/actor.model'
import { buildVideoLink, buildVideoEmbed } from 'src/assets/player/utils'
import { getAbsoluteAPIUrl } from '@app/shared/misc/utils'
import { DomSanitizer } from '@angular/platform-browser'

@Component({
  selector: 'my-video-abuse-list',
  templateUrl: './video-abuse-list.component.html',
  styleUrls: [ '../moderation.component.scss']
})
export class VideoAbuseListComponent extends RestTable implements OnInit {
  @ViewChild('moderationCommentModal', { static: true }) moderationCommentModal: ModerationCommentModalComponent

  videoAbuses: (VideoAbuse & { moderationCommentHtml?: string, reasonHtml?: string })[] = []
  totalRecords = 0
  rowsPerPage = 10
  sort: SortMeta = { field: 'createdAt', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  videoAbuseActions: DropdownAction<VideoAbuse>[] = []

  constructor (
    private notifier: Notifier,
    private videoAbuseService: VideoAbuseService,
    private confirmService: ConfirmService,
    private i18n: I18n,
    private markdownRenderer: MarkdownService,
    private sanitizer: DomSanitizer
  ) {
    super()

    this.videoAbuseActions = [
      {
        label: this.i18n('Delete this report'),
        handler: videoAbuse => this.removeVideoAbuse(videoAbuse)
      },
      {
        label: this.i18n('Add note'),
        handler: videoAbuse => this.openModerationCommentModal(videoAbuse),
        isDisplayed: videoAbuse => !videoAbuse.moderationComment
      },
      {
        label: this.i18n('Update note'),
        handler: videoAbuse => this.openModerationCommentModal(videoAbuse),
        isDisplayed: videoAbuse => !!videoAbuse.moderationComment
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
    this.initialize()
  }

  getIdentifier () {
    return 'VideoAbuseListComponent'
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

  getVideoEmbed (videoAbuse: VideoAbuse) {
    const absoluteAPIUrl = 'http://localhost:9000' || getAbsoluteAPIUrl()
    const embedUrl = buildVideoLink({
      baseUrl: absoluteAPIUrl + '/videos/embed/' + videoAbuse.video.uuid,
      warningTitle: false
    })
    return buildVideoEmbed(embedUrl)
  }

  switchToDefaultAvatar ($event: Event) {
    ($event.target as HTMLImageElement).src = Actor.GET_DEFAULT_AVATAR_URL()
  }

  async removeVideoAbuse (videoAbuse: VideoAbuse) {
    const res = await this.confirmService.confirm(this.i18n('Do you really want to delete this abuse report?'), this.i18n('Delete'))
    if (res === false) return

    this.videoAbuseService.removeVideoAbuse(videoAbuse).subscribe(
      () => {
        this.notifier.success(this.i18n('Abuse deleted.'))
        this.loadData()
      },

      err => this.notifier.error(err.message)
    )
  }

  updateVideoAbuseState (videoAbuse: VideoAbuse, state: VideoAbuseState) {
    this.videoAbuseService.updateVideoAbuse(videoAbuse, { state })
      .subscribe(
        () => this.loadData(),

        err => this.notifier.error(err.message)
      )

  }

  protected loadData () {
    return this.videoAbuseService.getVideoAbuses(this.pagination, this.sort)
               .subscribe(
                 async resultList => {
                   this.totalRecords = resultList.total

                   this.videoAbuses = resultList.data

                   for (const abuse of this.videoAbuses) {
                     Object.assign(abuse, {
                       reasonHtml: await this.toHtml(abuse.reason),
                       moderationCommentHtml: await this.toHtml(abuse.moderationComment),
                       embedHtml: this.sanitizer.bypassSecurityTrustHtml(this.getVideoEmbed(abuse))
                     })
                   }

                 },

                 err => this.notifier.error(err.message)
               )
  }

  private toHtml (text: string) {
    return this.markdownRenderer.textMarkdownToHTML(text)
  }
}
