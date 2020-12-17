import * as debug from 'debug'
import truncate from 'lodash-es/truncate'
import { SortMeta } from 'primeng/api'
import { buildVideoLink, buildVideoOrPlaylistEmbed } from 'src/assets/player/utils'
import { environment } from 'src/environments/environment'
import { AfterViewInit, Component, Input, OnInit, ViewChild } from '@angular/core'
import { DomSanitizer } from '@angular/platform-browser'
import { ActivatedRoute, Router } from '@angular/router'
import { ConfirmService, MarkdownService, Notifier, RestPagination, RestTable } from '@app/core'
import { Account, Actor, DropdownAction, Video, VideoService } from '@app/shared/shared-main'
import { AbuseService, BlocklistService, VideoBlockService } from '@app/shared/shared-moderation'
import { VideoCommentService } from '@app/shared/shared-video-comment'
import { AbuseState, AdminAbuse } from '@shared/models'
import { AbuseMessageModalComponent } from './abuse-message-modal.component'
import { ModerationCommentModalComponent } from './moderation-comment-modal.component'
import { ProcessedAbuse } from './processed-abuse.model'

const logger = debug('peertube:moderation:AbuseListTableComponent')

@Component({
  selector: 'my-abuse-list-table',
  templateUrl: './abuse-list-table.component.html',
  styleUrls: [ '../shared-moderation/moderation.scss', './abuse-list-table.component.scss' ]
})
export class AbuseListTableComponent extends RestTable implements OnInit, AfterViewInit {
  @Input() viewType: 'admin' | 'user'
  @Input() baseRoute: string

  @ViewChild('abuseMessagesModal', { static: true }) abuseMessagesModal: AbuseMessageModalComponent
  @ViewChild('moderationCommentModal', { static: true }) moderationCommentModal: ModerationCommentModalComponent

  abuses: ProcessedAbuse[] = []
  totalRecords = 0
  sort: SortMeta = { field: 'createdAt', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  abuseActions: DropdownAction<ProcessedAbuse>[][] = []

  constructor (
    protected route: ActivatedRoute,
    protected router: Router,
    private notifier: Notifier,
    private abuseService: AbuseService,
    private blocklistService: BlocklistService,
    private commentService: VideoCommentService,
    private videoService: VideoService,
    private videoBlocklistService: VideoBlockService,
    private confirmService: ConfirmService,
    private markdownRenderer: MarkdownService,
    private sanitizer: DomSanitizer
  ) {
    super()
  }

  ngOnInit () {
    this.abuseActions = [
      this.buildInternalActions(),

      this.buildFlaggedAccountActions(),

      this.buildCommentActions(),

      this.buildVideoActions(),

      this.buildAccountActions()
    ]

    this.initialize()
    this.listenToSearchChange()
  }

  ngAfterViewInit () {
    if (this.search) this.setTableFilter(this.search, false)
  }

  isAdminView () {
    return this.viewType === 'admin'
  }

  getIdentifier () {
    return 'AbuseListTableComponent'
  }

  openModerationCommentModal (abuse: AdminAbuse) {
    this.moderationCommentModal.openModal(abuse)
  }

  onModerationCommentUpdated () {
    this.loadData()
  }

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
    return buildVideoOrPlaylistEmbed(
      buildVideoLink({
        baseUrl: `${environment.originServerUrl}/videos/embed/${abuse.video.uuid}`,
        title: false,
        warningTitle: false,
        startTime: abuse.video.startAt,
        stopTime: abuse.video.endAt
      })
    )
  }

  switchToDefaultAvatar ($event: Event) {
    ($event.target as HTMLImageElement).src = Account.GET_DEFAULT_AVATAR_URL()
  }

  async removeAbuse (abuse: AdminAbuse) {
    const res = await this.confirmService.confirm($localize`Do you really want to delete this abuse report?`, $localize`Delete`)
    if (res === false) return

    this.abuseService.removeAbuse(abuse).subscribe(
      () => {
        this.notifier.success($localize`Abuse deleted.`)
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

  isLocalAbuse (abuse: AdminAbuse) {
    if (this.viewType === 'user') return true

    return Actor.IS_LOCAL(abuse.reporterAccount.host)
  }

  protected loadData () {
    logger('Loading data.')

    const options = {
      pagination: this.pagination,
      sort: this.sort,
      search: this.search
    }

    const observable = this.viewType === 'admin'
      ? this.abuseService.getAdminAbuses(options)
      : this.abuseService.getUserAbuses(options)

    return observable.subscribe(
        async resultList => {
          this.totalRecords = resultList.total

          this.abuses = []

          for (const a of resultList.data) {
            const abuse = a as ProcessedAbuse

            abuse.reasonHtml = await this.toHtml(abuse.reason)

            if (abuse.moderationComment) {
              abuse.moderationCommentHtml = await this.toHtml(abuse.moderationComment)
            }

            if (abuse.video) {
              abuse.embedHtml = this.sanitizer.bypassSecurityTrustHtml(this.getVideoEmbed(abuse))

              if (abuse.video.channel?.ownerAccount) {
                abuse.video.channel.ownerAccount = new Account(abuse.video.channel.ownerAccount)
              }
            }

            if (abuse.comment) {
              if (abuse.comment.deleted) {
                abuse.truncatedCommentHtml = abuse.commentHtml = $localize`Deleted comment`
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
        label: $localize`Internal actions`,
        isHeader: true
      },
      {
        label: this.isAdminView()
          ? $localize`Messages with reporter`
          : $localize`Messages with moderators`,
        handler: abuse => this.openAbuseMessagesModal(abuse),
        isDisplayed: abuse => this.isLocalAbuse(abuse)
      },
      {
        label: $localize`Update internal note`,
        handler: abuse => this.openModerationCommentModal(abuse),
        isDisplayed: abuse => this.isAdminView() && !!abuse.moderationComment
      },
      {
        label: $localize`Mark as accepted`,
        handler: abuse => this.updateAbuseState(abuse, AbuseState.ACCEPTED),
        isDisplayed: abuse => this.isAdminView() && !this.isAbuseAccepted(abuse)
      },
      {
        label: $localize`Mark as rejected`,
        handler: abuse => this.updateAbuseState(abuse, AbuseState.REJECTED),
        isDisplayed: abuse => this.isAdminView() && !this.isAbuseRejected(abuse)
      },
      {
        label: $localize`Add internal note`,
        handler: abuse => this.openModerationCommentModal(abuse),
        isDisplayed: abuse => this.isAdminView() && !abuse.moderationComment
      },
      {
        label: $localize`Delete report`,
        handler: abuse => this.isAdminView() && this.removeAbuse(abuse)
      }
    ]
  }

  private buildFlaggedAccountActions (): DropdownAction<ProcessedAbuse>[] {
    if (!this.isAdminView()) return []

    return [
      {
        label: $localize`Actions for the flagged account`,
        isHeader: true,
        isDisplayed: abuse => abuse.flaggedAccount && !abuse.comment && !abuse.video
      },

      {
        label: $localize`Mute account`,
        isDisplayed: abuse => abuse.flaggedAccount && !abuse.comment && !abuse.video,
        handler: abuse => this.muteAccountHelper(abuse.flaggedAccount)
      },

      {
        label: $localize`Mute server account`,
        isDisplayed: abuse => abuse.flaggedAccount && !abuse.comment && !abuse.video,
        handler: abuse => this.muteServerHelper(abuse.flaggedAccount.host)
      }
    ]
  }

  private buildAccountActions (): DropdownAction<ProcessedAbuse>[] {
    if (!this.isAdminView()) return []

    return [
      {
        label: $localize`Actions for the reporter`,
        isHeader: true,
        isDisplayed: abuse => !!abuse.reporterAccount
      },

      {
        label: $localize`Mute reporter`,
        isDisplayed: abuse => !!abuse.reporterAccount,
        handler: abuse => this.muteAccountHelper(abuse.reporterAccount)
      },

      {
        label: $localize`Mute server`,
        isDisplayed: abuse => abuse.reporterAccount && !abuse.reporterAccount.userId,
        handler: abuse => this.muteServerHelper(abuse.reporterAccount.host)
      }
    ]
  }

  private buildVideoActions (): DropdownAction<ProcessedAbuse>[] {
    if (!this.isAdminView()) return []

    return [
      {
        label: $localize`Actions for the video`,
        isHeader: true,
        isDisplayed: abuse => abuse.video && !abuse.video.deleted
      },
      {
        label: $localize`Block video`,
        isDisplayed: abuse => abuse.video && !abuse.video.deleted && !abuse.video.blacklisted,
        handler: abuse => {
          this.videoBlocklistService.blockVideo(abuse.video.id, undefined, abuse.video.channel.isLocal)
            .subscribe(
              () => {
                this.notifier.success($localize`Video blocked.`)

                this.updateAbuseState(abuse, AbuseState.ACCEPTED)
              },

              err => this.notifier.error(err.message)
            )
        }
      },
      {
        label: $localize`Unblock video`,
        isDisplayed: abuse => abuse.video && !abuse.video.deleted && abuse.video.blacklisted,
        handler: abuse => {
          this.videoBlocklistService.unblockVideo(abuse.video.id)
            .subscribe(
              () => {
                this.notifier.success($localize`Video unblocked.`)

                this.updateAbuseState(abuse, AbuseState.ACCEPTED)
              },

              err => this.notifier.error(err.message)
            )
        }
      },
      {
        label: $localize`Delete video`,
        isDisplayed: abuse => abuse.video && !abuse.video.deleted,
        handler: async abuse => {
          const res = await this.confirmService.confirm(
            $localize`Do you really want to delete this video?`,
            $localize`Delete`
          )
          if (res === false) return

          this.videoService.removeVideo(abuse.video.id)
            .subscribe(
              () => {
                this.notifier.success($localize`Video deleted.`)

                this.updateAbuseState(abuse, AbuseState.ACCEPTED)
              },

              err => this.notifier.error(err.message)
            )
        }
      }
    ]
  }

  private buildCommentActions (): DropdownAction<ProcessedAbuse>[] {
    if (!this.isAdminView()) return []

    return [
      {
        label: $localize`Actions for the comment`,
        isHeader: true,
        isDisplayed: abuse => abuse.comment && !abuse.comment.deleted
      },

      {
        label: $localize`Delete comment`,
        isDisplayed: abuse => abuse.comment && !abuse.comment.deleted,
        handler: async abuse => {
          const res = await this.confirmService.confirm(
            $localize`Do you really want to delete this comment?`,
            $localize`Delete`
          )
          if (res === false) return

          this.commentService.deleteVideoComment(abuse.comment.video.id, abuse.comment.id)
            .subscribe(
              () => {
                this.notifier.success($localize`Comment deleted.`)

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
          this.notifier.success($localize`Account ${account.nameWithHost} muted by the instance.`)
          account.mutedByInstance = true
        },

        err => this.notifier.error(err.message)
      )
  }

  private muteServerHelper (host: string) {
    this.blocklistService.blockServerByInstance(host)
      .subscribe(
        () => {
          this.notifier.success($localize`Server ${host} muted by the instance.`)
        },

        err => this.notifier.error(err.message)
      )
  }

  private toHtml (text: string) {
    return this.markdownRenderer.textMarkdownToHTML(text)
  }
}
