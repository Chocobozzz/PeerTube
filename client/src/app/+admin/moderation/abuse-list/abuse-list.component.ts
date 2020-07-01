import { SortMeta } from 'primeng/api'
import { buildVideoEmbed, buildVideoLink } from 'src/assets/player/utils'
import { environment } from 'src/environments/environment'
import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core'
import { DomSanitizer } from '@angular/platform-browser'
import { ActivatedRoute, Params, Router } from '@angular/router'
import { ConfirmService, MarkdownService, Notifier, RestPagination, RestTable } from '@app/core'
import { Account, Actor, DropdownAction, Video, VideoService } from '@app/shared/shared-main'
import { AbuseService, BlocklistService, VideoBlockService } from '@app/shared/shared-moderation'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { Abuse, AbuseState } from '@shared/models'
import { ModerationCommentModalComponent } from './moderation-comment-modal.component'

export type ProcessedAbuse = Abuse & {
  moderationCommentHtml?: string,
  reasonHtml?: string
  embedHtml?: string
  updatedAt?: Date

  // override bare server-side definitions with rich client-side definitions
  reporterAccount: Account

  video: Abuse['video'] & {
    channel: Abuse['video']['channel'] & {
      ownerAccount: Account
    }
  }
}

@Component({
  selector: 'my-abuse-list',
  templateUrl: './abuse-list.component.html',
  styleUrls: [ '../moderation.component.scss', './abuse-list.component.scss' ]
})
export class AbuseListComponent extends RestTable implements OnInit, AfterViewInit {
  @ViewChild('moderationCommentModal', { static: true }) moderationCommentModal: ModerationCommentModalComponent

  abuses: ProcessedAbuse[] = []
  totalRecords = 0
  sort: SortMeta = { field: 'createdAt', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  abuseActions: DropdownAction<Abuse>[][] = []

  constructor (
    private notifier: Notifier,
    private abuseService: AbuseService,
    private blocklistService: BlocklistService,
    private videoService: VideoService,
    private videoBlocklistService: VideoBlockService,
    private confirmService: ConfirmService,
    private i18n: I18n,
    private markdownRenderer: MarkdownService,
    private sanitizer: DomSanitizer,
    private route: ActivatedRoute,
    private router: Router
  ) {
    super()

    this.abuseActions = [
      [
        {
          label: this.i18n('Internal actions'),
          isHeader: true
        },
        {
          label: this.i18n('Delete report'),
          handler: abuse => this.removeAbuse(abuse)
        },
        {
          label: this.i18n('Add note'),
          handler: abuse => this.openModerationCommentModal(abuse),
          isDisplayed: abuse => !abuse.moderationComment
        },
        {
          label: this.i18n('Update note'),
          handler: abuse => this.openModerationCommentModal(abuse),
          isDisplayed: abuse => !!abuse.moderationComment
        },
        {
          label: this.i18n('Mark as accepted'),
          handler: abuse => this.updateAbuseState(abuse, AbuseState.ACCEPTED),
          isDisplayed: abuse => !this.isAbuseAccepted(abuse)
        },
        {
          label: this.i18n('Mark as rejected'),
          handler: abuse => this.updateAbuseState(abuse, AbuseState.REJECTED),
          isDisplayed: abuse => !this.isAbuseRejected(abuse)
        }
      ],
      [
        {
          label: this.i18n('Actions for the video'),
          isHeader: true,
          isDisplayed: abuse => !abuse.video.deleted
        },
        {
          label: this.i18n('Block video'),
          isDisplayed: abuse => !abuse.video.deleted && !abuse.video.blacklisted,
          handler: abuse => {
            this.videoBlocklistService.blockVideo(abuse.video.id, undefined, true)
              .subscribe(
                () => {
                  this.notifier.success(this.i18n('Video blocked.'))

                  this.updateAbuseState(abuse, AbuseState.ACCEPTED)
                },

                err => this.notifier.error(err.message)
              )
          }
        },
        {
          label: this.i18n('Unblock video'),
          isDisplayed: abuse => !abuse.video.deleted && abuse.video.blacklisted,
          handler: abuse => {
            this.videoBlocklistService.unblockVideo(abuse.video.id)
              .subscribe(
                () => {
                  this.notifier.success(this.i18n('Video unblocked.'))

                  this.updateAbuseState(abuse, AbuseState.ACCEPTED)
                },

                err => this.notifier.error(err.message)
              )
          }
        },
        {
          label: this.i18n('Delete video'),
          isDisplayed: abuse => !abuse.video.deleted,
          handler: async abuse => {
            const res = await this.confirmService.confirm(
              this.i18n('Do you really want to delete this video?'),
              this.i18n('Delete')
            )
            if (res === false) return

            this.videoService.removeVideo(abuse.video.id)
              .subscribe(
                () => {
                  this.notifier.success(this.i18n('Video deleted.'))

                  this.updateAbuseState(abuse, AbuseState.ACCEPTED)
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
          handler: async abuse => {
            const account = abuse.reporterAccount as Account

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
          isDisplayed: abuse => !abuse.reporterAccount.userId,
          handler: async abuse => {
            this.blocklistService.blockServerByInstance(abuse.reporterAccount.host)
              .subscribe(
                () => {
                  this.notifier.success(
                    this.i18n('Server {{host}} muted by the instance.', { host: abuse.reporterAccount.host })
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
      .subscribe(params => {
        this.search = params.search || ''

        this.setTableFilter(this.search)
        this.loadData()
      })
  }

  ngAfterViewInit () {
    if (this.search) this.setTableFilter(this.search)
  }

  getIdentifier () {
    return 'AbuseListComponent'
  }

  openModerationCommentModal (abuse: Abuse) {
    this.moderationCommentModal.openModal(abuse)
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

  isAbuseAccepted (abuse: Abuse) {
    return abuse.state.id === AbuseState.ACCEPTED
  }

  isAbuseRejected (abuse: Abuse) {
    return abuse.state.id === AbuseState.REJECTED
  }

  getVideoUrl (abuse: Abuse) {
    return Video.buildClientUrl(abuse.video.uuid)
  }

  getVideoEmbed (abuse: Abuse) {
    return buildVideoEmbed(
      buildVideoLink({
        baseUrl: `${environment.embedUrl}/videos/embed/${abuse.video.uuid}`,
        title: false,
        warningTitle: false,
        startTime: abuse.startAt,
        stopTime: abuse.endAt
      })
    )
  }

  switchToDefaultAvatar ($event: Event) {
    ($event.target as HTMLImageElement).src = Actor.GET_DEFAULT_AVATAR_URL()
  }

  async removeAbuse (abuse: Abuse) {
    const res = await this.confirmService.confirm(this.i18n('Do you really want to delete this abuse report?'), this.i18n('Delete'))
    if (res === false) return

    this.abuseService.removeAbuse(abuse).subscribe(
      () => {
        this.notifier.success(this.i18n('Abuse deleted.'))
        this.loadData()
      },

      err => this.notifier.error(err.message)
    )
  }

  updateAbuseState (abuse: Abuse, state: AbuseState) {
    this.abuseService.updateAbuse(abuse, { state })
      .subscribe(
        () => this.loadData(),

        err => this.notifier.error(err.message)
      )
  }

  protected loadData () {
    return this.abuseService.getAbuses({
      pagination: this.pagination,
      sort: this.sort,
      search: this.search
    }).subscribe(
        async resultList => {
          this.totalRecords = resultList.total
          const abuses = []

          for (const abuse of resultList.data) {
            Object.assign(abuse, {
              reasonHtml: await this.toHtml(abuse.reason),
              moderationCommentHtml: await this.toHtml(abuse.moderationComment),
              embedHtml: this.sanitizer.bypassSecurityTrustHtml(this.getVideoEmbed(abuse)),
              reporterAccount: new Account(abuse.reporterAccount)
            })

            if (abuse.video.channel?.ownerAccount) abuse.video.channel.ownerAccount = new Account(abuse.video.channel.ownerAccount)
            if (abuse.updatedAt === abuse.createdAt) delete abuse.updatedAt

            abuses.push(abuse as ProcessedAbuse)
          }

          this.abuses = abuses
        },

        err => this.notifier.error(err.message)
      )
  }

  private toHtml (text: string) {
    return this.markdownRenderer.textMarkdownToHTML(text)
  }
}
