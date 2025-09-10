import { CommonModule } from '@angular/common'
import { Component, OnDestroy, OnInit, inject, input, viewChild } from '@angular/core'
import { ConfirmService, HooksService, MarkdownService, Notifier, PluginService } from '@app/core'
import { formatICU } from '@app/helpers'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { AbuseState, AbuseStateType, AdminAbuse, ResultList } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import debug from 'debug'
import { switchMap } from 'rxjs'
import { ActorAvatarComponent } from '../shared-actor-image/actor-avatar.component'
import { AdvancedInputFilter, AdvancedInputFilterComponent } from '../shared-forms/advanced-input-filter.component'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { Account } from '../shared-main/account/account.model'
import { Actor } from '../shared-main/account/actor.model'
import { ActionDropdownComponent, DropdownAction } from '../shared-main/buttons/action-dropdown.component'
import { PTDatePipe } from '../shared-main/common/date.pipe'
import { NumberFormatterPipe } from '../shared-main/common/number-formatter.pipe'
import { Video } from '../shared-main/video/video.model'
import { VideoService } from '../shared-main/video/video.service'
import { AbuseService } from '../shared-moderation/abuse.service'
import { BlocklistService } from '../shared-moderation/blocklist.service'
import { VideoBlockService } from '../shared-moderation/video-block.service'
import { DataLoaderOptions, TableColumnInfo, TableComponent } from '../shared-tables/table.component'
import { VideoCellComponent } from '../shared-tables/video-cell.component'
import { VideoCommentService } from '../shared-video-comment/video-comment.service'
import { AbuseDetailsComponent } from './abuse-details.component'
import { AbuseMessageModalComponent } from './abuse-message-modal.component'
import { ModerationCommentModalComponent } from './moderation-comment-modal.component'
import { ProcessedAbuse } from './processed-abuse.model'

const debugLogger = debug('peertube:moderation:AbuseListTableComponent')

@Component({
  selector: 'my-abuse-list-table',
  templateUrl: './abuse-list-table.component.html',
  styleUrls: [ '../shared-moderation/moderation.scss', './abuse-list-table.component.scss' ],
  imports: [
    CommonModule,
    AdvancedInputFilterComponent,
    NgbTooltip,
    ActionDropdownComponent,
    ActorAvatarComponent,
    VideoCellComponent,
    GlobalIconComponent,
    AbuseDetailsComponent,
    ModerationCommentModalComponent,
    AbuseMessageModalComponent,
    PTDatePipe,
    TableComponent,
    NumberFormatterPipe
  ]
})
export class AbuseListTableComponent implements OnInit, OnDestroy {
  private notifier = inject(Notifier)
  private abuseService = inject(AbuseService)
  private blocklistService = inject(BlocklistService)
  private commentService = inject(VideoCommentService)
  private videoService = inject(VideoService)
  private videoBlocklistService = inject(VideoBlockService)
  private confirmService = inject(ConfirmService)
  private markdownRenderer = inject(MarkdownService)
  private hooks = inject(HooksService)
  private pluginService = inject(PluginService)

  readonly viewType = input<'admin' | 'user'>(undefined)

  readonly table = viewChild<TableComponent<ProcessedAbuse>>('table')
  readonly abuseMessagesModal = viewChild<AbuseMessageModalComponent>('abuseMessagesModal')
  readonly moderationCommentModal = viewChild<ModerationCommentModalComponent>('moderationCommentModal')

  abuseActions: DropdownAction<ProcessedAbuse>[][] = []

  inputFilters: AdvancedInputFilter[] = [
    {
      title: $localize`Advanced filters`,
      children: [
        {
          value: 'state:pending',
          label: $localize`Unsolved reports`
        },
        {
          value: 'state:accepted',
          label: $localize`Accepted reports`
        },
        {
          value: 'state:rejected',
          label: $localize`Refused reports`
        },
        {
          value: 'videoIs:blacklisted',
          label: $localize`Reports with blocked videos`
        },
        {
          value: 'videoIs:deleted',
          label: $localize`Reports with deleted videos`
        }
      ]
    }
  ]

  columns: TableColumnInfo<string>[] = [
    { id: 'target', label: $localize`Video/Comment/Account`, sortable: false },
    { id: 'createdAt', label: $localize`Created`, sortable: true },
    { id: 'state', label: $localize`State`, sortable: true },
    { id: 'comment', label: $localize`Messages`, sortable: false }
  ]

  dataLoader: typeof this._dataLoader

  constructor () {
    this.dataLoader = this._dataLoader.bind(this)
  }

  async ngOnInit () {
    const viewType = this.viewType()

    if (viewType === 'admin') {
      this.pluginService.addAction('admin-abuse-list:load-data', () => this.table().loadData())

      this.columns = [
        { id: 'reporterAccount', label: $localize`Reporter`, sortable: false },

        ...this.columns,

        { id: 'internalNote', label: $localize`Internal note`, sortable: false }
      ]
    }

    const abuseActions: DropdownAction<ProcessedAbuse>[][] = [
      this.buildInternalActions(),

      this.buildFlaggedAccountActions(),

      this.buildCommentActions(),

      this.buildVideoActions(),

      this.buildAccountActions()
    ]

    this.abuseActions = viewType === 'admin'
      ? await this.hooks.wrapObject(abuseActions, 'admin-comments', 'filter:admin-abuse-list.actions.create.result')
      : abuseActions
  }

  ngOnDestroy () {
    if (this.viewType() === 'admin') {
      this.pluginService.removeAction('admin-abuse-list:load-data')
    }
  }

  isAdminView () {
    return this.viewType() === 'admin'
  }

  openModerationCommentModal (abuse: AdminAbuse) {
    this.moderationCommentModal().openModal(abuse)
  }

  onModerationCommentUpdated () {
    this.table().loadData()
  }

  isAbuseAccepted (abuse: AdminAbuse) {
    return abuse.state.id === AbuseState.ACCEPTED
  }

  isAbuseRejected (abuse: AdminAbuse) {
    return abuse.state.id === AbuseState.REJECTED
  }

  getVideoUrl (abuse: AdminAbuse) {
    return Video.buildWatchUrl(abuse.video)
  }

  getCommentUrl (abuse: AdminAbuse) {
    return Video.buildWatchUrl(abuse.comment.video) + ';threadId=' + abuse.comment.threadId
  }

  getAccountUrl (abuse: ProcessedAbuse) {
    return '/a/' + abuse.flaggedAccount.nameWithHost
  }

  async removeAbuse (abuse: AdminAbuse) {
    const res = await this.confirmService.confirm($localize`Do you really want to delete this abuse report?`, $localize`Delete`)
    if (res === false) return

    this.abuseService.removeAbuse(abuse)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Abuse deleted.`)
          this.table().loadData()
        },

        error: err => this.notifier.error(err.message)
      })
  }

  updateAbuseState (abuse: AdminAbuse, state: AbuseStateType) {
    this.abuseService.updateAbuse(abuse, { state })
      .subscribe({
        next: () => this.table().loadData(),

        error: err => this.notifier.error(err.message)
      })
  }

  onCountMessagesUpdated (event: { abuseId: number, countMessages: number }) {
    const abuse = this.table().data.find(a => a.id === event.abuseId)

    if (!abuse) {
      logger.error(`Cannot find abuse ${event.abuseId}`)
      return
    }

    abuse.countMessages = event.countMessages
  }

  openAbuseMessagesModal (abuse: AdminAbuse) {
    this.abuseMessagesModal().openModal(abuse)
  }

  isLocalAbuse (abuse: AdminAbuse) {
    if (this.viewType() === 'user') return true
    if (!abuse.reporterAccount) return false

    return Actor.IS_LOCAL(abuse.reporterAccount.host)
  }

  getSendMessageButtonLabel (abuse: AdminAbuse) {
    if (this.viewType() === 'admin') {
      return formatICU(
        $localize`Send a message to the reporter (currently {count, plural, =1 {{count} message} other {{count} messages}})`,
        { count: abuse.countMessages }
      )
    }

    return formatICU(
      $localize`Send a message to the admins/moderators (currently {count, plural, =1 {{count} message} other {{count} messages}})`,
      { count: abuse.countMessages }
    )
  }

  private _dataLoader (options: DataLoaderOptions) {
    debugLogger('Loading data.')

    const observable = this.viewType() === 'admin'
      ? this.abuseService.getAdminAbuses(options)
      : this.abuseService.getUserAbuses(options)

    return observable.pipe(switchMap(async (resultList: ResultList<ProcessedAbuse>) => {
      const abuses: ProcessedAbuse[] = []

      for (const abuse of resultList.data) {
        abuse.reasonHtml = await this.toHtml(abuse.reason)

        if (abuse.moderationComment) {
          abuse.moderationCommentHtml = await this.toHtml(abuse.moderationComment)
        }

        if (abuse.video) {
          if (abuse.video.channel?.ownerAccount) {
            abuse.video.channel.ownerAccount = new Account(abuse.video.channel.ownerAccount)
          }
        }

        if (abuse.comment) {
          if (abuse.comment.deleted) {
            abuse.commentHTML = $localize`Deleted comment`
          } else {
            abuse.commentHTML = await this.markdownRenderer.textMarkdownToHTML({ markdown: abuse.comment.text, withHtml: true })
          }
        }

        if (abuse.reporterAccount) {
          abuse.reporterAccount = new Account(abuse.reporterAccount)
        }

        if (abuse.flaggedAccount) {
          abuse.flaggedAccount = new Account(abuse.flaggedAccount)
        }

        if (abuse.updatedAt === abuse.createdAt) delete abuse.updatedAt

        abuses.push(abuse)
      }

      return { total: resultList.total, data: abuses }
    }))
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
        handler: abuse => this.removeAbuse(abuse),
        isDisplayed: () => this.isAdminView()
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
          this.videoBlocklistService.blockVideo([ { videoId: abuse.video.id, unfederate: abuse.video.channel.isLocal } ])
            .subscribe({
              next: () => {
                this.notifier.success($localize`Video blocked.`)

                this.updateAbuseState(abuse, AbuseState.ACCEPTED)
              },

              error: err => this.notifier.error(err.message)
            })
        }
      },
      {
        label: $localize`Unblock video`,
        isDisplayed: abuse => abuse.video && !abuse.video.deleted && abuse.video.blacklisted,
        handler: abuse => {
          this.videoBlocklistService.unblockVideo(abuse.video.id)
            .subscribe({
              next: () => {
                this.notifier.success($localize`Video unblocked.`)

                this.updateAbuseState(abuse, AbuseState.ACCEPTED)
              },

              error: err => this.notifier.error(err.message)
            })
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
            .subscribe({
              next: () => {
                this.notifier.success($localize`Video deleted.`)

                this.updateAbuseState(abuse, AbuseState.ACCEPTED)
              },

              error: err => this.notifier.error(err.message)
            })
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
            .subscribe({
              next: () => {
                this.notifier.success($localize`Comment deleted.`)

                this.updateAbuseState(abuse, AbuseState.ACCEPTED)
              },

              error: err => this.notifier.error(err.message)
            })
        }
      }
    ]
  }

  private muteAccountHelper (account: Account) {
    this.blocklistService.blockAccountByInstance(account)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Account ${account.nameWithHost} muted by your platform.`)
          account.mutedByInstance = true
        },

        error: err => this.notifier.error(err.message)
      })
  }

  private muteServerHelper (host: string) {
    this.blocklistService.blockServerByInstance(host)
      .subscribe({
        next: () => {
          this.notifier.success($localize`${host} muted by your platform.`)
        },

        error: err => this.notifier.error(err.message)
      })
  }

  private toHtml (text: string) {
    return this.markdownRenderer.textMarkdownToHTML({ markdown: text })
  }
}
