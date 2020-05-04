import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core'
import { Account } from '@app/shared/account/account.model'
import { Notifier } from '@app/core'
import { SortMeta } from 'primeng/api'
import { VideoAbuse, VideoAbuseState } from '../../../../../../shared'
import { RestPagination, RestTable, VideoAbuseService, VideoBlacklistService } from '../../../shared'
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
import { BlocklistService } from '@app/shared/blocklist'
import { VideoService } from '@app/shared/video/video.service'
import { ActivatedRoute, Params, Router } from '@angular/router'
import { filter } from 'rxjs/operators'

export type ProcessedVideoAbuse = VideoAbuse & {
  moderationCommentHtml?: string,
  reasonHtml?: string
  embedHtml?: string
  updatedAt?: Date
  // override bare server-side definitions with rich client-side definitions
  reporterAccount: Account
  video: VideoAbuse['video'] & {
    channel: VideoAbuse['video']['channel'] & {
      ownerAccount: Account
    }
  }
}

@Component({
  selector: 'my-video-abuse-list',
  templateUrl: './video-abuse-list.component.html',
  styleUrls: [ '../moderation.component.scss', './video-abuse-list.component.scss' ]
})
export class VideoAbuseListComponent extends RestTable implements OnInit, AfterViewInit {
  @ViewChild('moderationCommentModal', { static: true }) moderationCommentModal: ModerationCommentModalComponent

  videoAbuses: ProcessedVideoAbuse[] = []
  totalRecords = 0
  sort: SortMeta = { field: 'createdAt', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  videoAbuseActions: DropdownAction<VideoAbuse>[][] = []

  constructor (
    private notifier: Notifier,
    private videoAbuseService: VideoAbuseService,
    private blocklistService: BlocklistService,
    private videoService: VideoService,
    private videoBlacklistService: VideoBlacklistService,
    private confirmService: ConfirmService,
    private i18n: I18n,
    private markdownRenderer: MarkdownService,
    private sanitizer: DomSanitizer,
    private route: ActivatedRoute,
    private router: Router
  ) {
    super()

    this.videoAbuseActions = [
      [
        {
          label: this.i18n('Internal actions'),
          isHeader: true
        },
        {
          label: this.i18n('Delete report'),
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
      ],
      [
        {
          label: this.i18n('Actions for the video'),
          isHeader: true,
          isDisplayed: videoAbuse => !videoAbuse.video.deleted
        },
        {
          label: this.i18n('Blacklist video'),
          isDisplayed: videoAbuse => !videoAbuse.video.deleted && !videoAbuse.video.blacklisted,
          handler: videoAbuse => {
            this.videoBlacklistService.blacklistVideo(videoAbuse.video.id, undefined, true)
              .subscribe(
                () => {
                  this.notifier.success(this.i18n('Video blacklisted.'))

                  this.updateVideoAbuseState(videoAbuse, VideoAbuseState.ACCEPTED)
                },

                err => this.notifier.error(err.message)
              )
          }
        },
        {
          label: this.i18n('Unblacklist video'),
          isDisplayed: videoAbuse => !videoAbuse.video.deleted && videoAbuse.video.blacklisted,
          handler: videoAbuse => {
            this.videoBlacklistService.removeVideoFromBlacklist(videoAbuse.video.id)
              .subscribe(
                () => {
                  this.notifier.success(this.i18n('Video unblacklisted.'))

                  this.updateVideoAbuseState(videoAbuse, VideoAbuseState.ACCEPTED)
                },

                err => this.notifier.error(err.message)
              )
          }
        },
        {
          label: this.i18n('Delete video'),
          isDisplayed: videoAbuse => !videoAbuse.video.deleted,
          handler: async videoAbuse => {
            const res = await this.confirmService.confirm(
              this.i18n('Do you really want to delete this video?'),
              this.i18n('Delete')
            )
            if (res === false) return

            this.videoService.removeVideo(videoAbuse.video.id)
              .subscribe(
                () => {
                  this.notifier.success(this.i18n('Video deleted.'))

                  this.updateVideoAbuseState(videoAbuse, VideoAbuseState.ACCEPTED)
                },

                err => this.notifier.error(err.message)
              )
          }
        }
      ],
      [
        {
          label: this.i18n('Actions for the reporter'),
          isHeader: true
        },
        {
          label: this.i18n('Mute reporter'),
          handler: async videoAbuse => {
            const account = videoAbuse.reporterAccount as Account

            this.blocklistService.blockAccountByInstance(account)
              .subscribe(
                () => {
                  this.notifier.success(
                    this.i18n('Account {{nameWithHost}} muted by the instance.', { nameWithHost: account.nameWithHost })
                  )

                  account.mutedByInstance = true
                },

                err => this.notifier.error(err.message)
              )
          }
        },
        {
          label: this.i18n('Mute server'),
          isDisplayed: videoAbuse => !videoAbuse.reporterAccount.userId,
          handler: async videoAbuse => {
            this.blocklistService.blockServerByInstance(videoAbuse.reporterAccount.host)
              .subscribe(
                () => {
                  this.notifier.success(
                    this.i18n('Server {{host}} muted by the instance.', { host: videoAbuse.reporterAccount.host })
                  )
                },

                err => this.notifier.error(err.message)
              )
          }
        }
      ]
    ]
  }

  ngOnInit () {
    this.initialize()

    this.route.queryParams
      .pipe(filter(params => params.search !== undefined && params.search !== null))
      .subscribe(params => {
        this.search = params.search
        this.setTableFilter(params.search)
        this.loadData()
      })
  }

  ngAfterViewInit () {
    if (this.search) this.setTableFilter(this.search)
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

  /* Table filter functions */
  onAbuseSearch (event: Event) {
    this.onSearch(event)
    this.setQueryParams((event.target as HTMLInputElement).value)
  }

  setQueryParams (search: string) {
    const queryParams: Params = {}
    if (search) Object.assign(queryParams, { search })
    this.router.navigate([ '/admin/moderation/video-abuses/list' ], { queryParams })
  }

  resetTableFilter () {
    this.setTableFilter('')
    this.setQueryParams('')
    this.resetSearch()
  }
  /* END Table filter functions */

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
    const absoluteAPIUrl = getAbsoluteAPIUrl()
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
    return this.videoAbuseService.getVideoAbuses({
      pagination: this.pagination,
      sort: this.sort,
      search: this.search
    }).subscribe(
        async resultList => {
          this.totalRecords = resultList.total
          this.videoAbuses = []

          for (const abuse of resultList.data) {
            Object.assign(abuse, {
              reasonHtml: await this.toHtml(abuse.reason),
              moderationCommentHtml: await this.toHtml(abuse.moderationComment),
              embedHtml: this.sanitizer.bypassSecurityTrustHtml(this.getVideoEmbed(abuse)),
              reporterAccount: new Account(abuse.reporterAccount)
            })

            if (abuse.video.channel?.ownerAccount) abuse.video.channel.ownerAccount = new Account(abuse.video.channel.ownerAccount)
            if (abuse.updatedAt === abuse.createdAt) delete abuse.updatedAt

            this.videoAbuses.push(abuse as ProcessedVideoAbuse)
          }

        },

        err => this.notifier.error(err.message)
      )
  }

  private toHtml (text: string) {
    return this.markdownRenderer.textMarkdownToHTML(text)
  }
}
