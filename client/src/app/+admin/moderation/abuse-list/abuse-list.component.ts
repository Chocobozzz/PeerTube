import * as debug from 'debug'
import truncate from 'lodash-es/truncate'
import { SortMeta } from 'primeng/api'
import { buildVideoEmbed, buildVideoLink } from 'src/assets/player/utils'
import { environment } from 'src/environments/environment'
import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
import { ActivatedRoute, Params, Router } from '@angular/router'
import { ConfirmService, MarkdownService, Notifier, RestPagination, RestTable } from '@app/core'
import { Account, Actor, DropdownAction, Video, VideoService } from '@app/shared/shared-main'
import { AbuseService, BlocklistService, VideoBlockService, AbuseMessageModalComponent } from '@app/shared/shared-moderation'
import { VideoCommentService } from '@app/shared/shared-video-comment'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { AdminAbuse, AbuseState } from '@shared/models'
import { ModerationCommentModalComponent } from './moderation-comment-modal.component'

const logger = debug('peertube:moderation:AbuseListComponent')

// Don't use an abuse model because we need external services to compute some properties
// And this model is only used in this component
export type ProcessedAbuse = AdminAbuse & {
  moderationCommentHtml?: string,
  reasonHtml?: string
  embedHtml?: SafeHtml
  updatedAt?: Date

  // override bare server-side definitions with rich client-side definitions
  reporterAccount?: Account
  flaggedAccount?: Account

  truncatedCommentHtml?: string
  commentHtml?: string

  video: AdminAbuse['video'] & {
    channel: AdminAbuse['video']['channel'] & {
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
  @ViewChild('abuseMessagesModal', { static: true }) abuseMessagesModal: AbuseMessageModalComponent

  abuses: ProcessedAbuse[] = []
  totalRecords = 0
  sort: SortMeta = { field: 'createdAt', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  abuseActions: DropdownAction<ProcessedAbuse>[][] = []

  constructor (
    private notifier: Notifier,
    private abuseService: AbuseService,
    private blocklistService: BlocklistService,
    private commentService: VideoCommentService,
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
      this.buildInternalActions(),

      this.buildFlaggedAccountActions(),

      this.buildCommentActions(),

      this.buildVideoActions(),

      this.buildAccountActions()
    ]
  }

  ngOnInit () {
    this.initialize()

    this.route.queryParams
      .subscribe(params => {
        this.search = params.search || ''

        logger('On URL change (search: %s).', this.search)

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

  openModerationCommentModal (abuse: AdminAbuse) {
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

    this.router.navigate([ '/admin/moderation/abuses/list' ], { queryParams })
  }

  resetTableFilter () {
    this.setTableFilter('')
    this.setQueryParams('')
    this.resetSearch()
  }
  /* END Table filter functions */

  isAbuseAccepted (abuse: AdminAbuse) {
    return abuse.state.id === AbuseState.ACCEPTED
  }

  isAbuseRejected (abuse: AdminAbuse) {
    return abuse.state.id === AbuseState.REJECTED
  }

  getVideoUrl (abuse: AdminAbuse) {
    return Video.buildClientUrl(abuse.video.uuid)
  }

  getCommentUrl (abuse: AdminAbuse) {
    return Video.buildClientUrl(abuse.comment.video.uuid) + ';threadId=' + abuse.comment.threadId
  }

  getAccountUrl (abuse: ProcessedAbuse) {
    return '/accounts/' + abuse.flaggedAccount.nameWithHost
  }

  getVideoEmbed (abuse: AdminAbuse) {
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

  async removeAbuse (abuse: AdminAbuse) {
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

  updateAbuseState (abuse: AdminAbuse, state: AbuseState) {
    this.abuseService.updateAbuse(abuse, { state })
      .subscribe(
        () => this.loadData(),

        err => this.notifier.error(err.message)
      )
  }

  onCountMessagesUpdated (event: { abuseId: number, countMessages: number }) {
    const abuse = this.abuses.find(a => a.id === event.abuseId)

    if (!abuse) {
      console.error('Cannot find abuse %d.', event.abuseId)
      return
    }

    abuse.countMessages = event.countMessages
  }

  openAbuseMessagesModal (abuse: AdminAbuse) {
    this.abuseMessagesModal.openModal(abuse)
  }

  protected loadData () {
    logger('Load data.')

    return this.abuseService.getAdminAbuses({
      pagination: this.pagination,
      sort: this.sort,
      search: this.search
    }).subscribe(
        async resultList => {
          this.totalRecords = resultList.total

          this.abuses = []

          for (const a of resultList.data) {
            const abuse = a as ProcessedAbuse

            abuse.reasonHtml = await this.toHtml(abuse.reason)
            abuse.moderationCommentHtml = await this.toHtml(abuse.moderationComment)

            if (abuse.video) {
              abuse.embedHtml = this.sanitizer.bypassSecurityTrustHtml(this.getVideoEmbed(abuse))

              if (abuse.video.channel?.ownerAccount) {
                abuse.video.channel.ownerAccount = new Account(abuse.video.channel.ownerAccount)
              }
            }

            if (abuse.comment) {
              if (abuse.comment.deleted) {
                abuse.truncatedCommentHtml = abuse.commentHtml = this.i18n('Deleted comment')
              } else {
                const truncated = truncate(abuse.comment.text, { length: 100 })
                abuse.truncatedCommentHtml = await this.markdownRenderer.textMarkdownToHTML(truncated, true)
                abuse.commentHtml = await this.markdownRenderer.textMarkdownToHTML(abuse.comment.text, true)
              }
            }

            if (abuse.reporterAccount) {
              abuse.reporterAccount = new Account(abuse.reporterAccount)
            }

            if (abuse.flaggedAccount) {
              abuse.flaggedAccount = new Account(abuse.flaggedAccount)
            }

            if (abuse.updatedAt === abuse.createdAt) delete abuse.updatedAt

            this.abuses.push(abuse)
          }
        },

        err => this.notifier.error(err.message)
      )
  }

  private buildInternalActions (): DropdownAction<ProcessedAbuse>[] {
    return [
      {
        label: this.i18n('Internal actions'),
        isHeader: true
      },
      {
        label: this.i18n('Delete report'),
        handler: abuse => this.removeAbuse(abuse)
      },
      {
        label: this.i18n('Messages'),
        handler: abuse => this.openAbuseMessagesModal(abuse)
      },
      {
        label: this.i18n('Add internal note'),
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
    ]
  }

  private buildFlaggedAccountActions (): DropdownAction<ProcessedAbuse>[] {
    return [
      {
        label: this.i18n('Actions for the flagged account'),
        isHeader: true,
        isDisplayed: abuse => abuse.flaggedAccount && !abuse.comment && !abuse.video
      },

      {
        label: this.i18n('Mute account'),
        isDisplayed: abuse => abuse.flaggedAccount && !abuse.comment && !abuse.video,
        handler: abuse => this.muteAccountHelper(abuse.flaggedAccount)
      },

      {
        label: this.i18n('Mute server account'),
        isDisplayed: abuse => abuse.flaggedAccount && !abuse.comment && !abuse.video,
        handler: abuse => this.muteServerHelper(abuse.flaggedAccount.host)
      }
    ]
  }

  private buildAccountActions (): DropdownAction<ProcessedAbuse>[] {
    return [
      {
        label: this.i18n('Actions for the reporter'),
        isHeader: true,
        isDisplayed: abuse => !!abuse.reporterAccount
      },

      {
        label: this.i18n('Mute reporter'),
        isDisplayed: abuse => !!abuse.reporterAccount,
        handler: abuse => this.muteAccountHelper(abuse.reporterAccount)
      },

      {
        label: this.i18n('Mute server'),
        isDisplayed: abuse => abuse.reporterAccount && !abuse.reporterAccount.userId,
        handler: abuse => this.muteServerHelper(abuse.reporterAccount.host)
      }
    ]
  }

  private buildVideoActions (): DropdownAction<ProcessedAbuse>[] {
    return [
      {
        label: this.i18n('Actions for the video'),
        isHeader: true,
        isDisplayed: abuse => abuse.video && !abuse.video.deleted
      },
      {
        label: this.i18n('Block video'),
        isDisplayed: abuse => abuse.video && !abuse.video.deleted && !abuse.video.blacklisted,
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
        isDisplayed: abuse => abuse.video && !abuse.video.deleted && abuse.video.blacklisted,
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
        isDisplayed: abuse => abuse.video && !abuse.video.deleted,
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
    ]
  }

  private buildCommentActions (): DropdownAction<ProcessedAbuse>[] {
    return [
      {
        label: this.i18n('Actions for the comment'),
        isHeader: true,
        isDisplayed: abuse => abuse.comment && !abuse.comment.deleted
      },

      {
        label: this.i18n('Delete comment'),
        isDisplayed: abuse => abuse.comment && !abuse.comment.deleted,
        handler: async abuse => {
          const res = await this.confirmService.confirm(
            this.i18n('Do you really want to delete this comment?'),
            this.i18n('Delete')
          )
          if (res === false) return

          this.commentService.deleteVideoComment(abuse.comment.video.id, abuse.comment.id)
            .subscribe(
              () => {
                this.notifier.success(this.i18n('Comment deleted.'))

                this.updateAbuseState(abuse, AbuseState.ACCEPTED)
              },

              err => this.notifier.error(err.message)
            )
        }
      }
    ]
  }

  private muteAccountHelper (account: Account) {
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

  private muteServerHelper (host: string) {
    this.blocklistService.blockServerByInstance(host)
      .subscribe(
        () => {
          this.notifier.success(
            this.i18n('Server {{host}} muted by the instance.', { host: host })
          )
        },

        err => this.notifier.error(err.message)
      )
  }

  private toHtml (text: string) {
    return this.markdownRenderer.textMarkdownToHTML(text)
  }
}
