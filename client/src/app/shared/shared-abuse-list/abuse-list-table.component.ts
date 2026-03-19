import { Component, OnDestroy, OnInit, inject, input, viewChild } from '@angular/core'
import { ConfirmService, HooksService, MarkdownService, Notifier, PluginService } from '@app/core'
import { formatICU } from '@app/helpers'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { AbuseState, AbuseStateType, AdminAbuse, ResultList } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import debug from 'debug'
import { switchMap } from 'rxjs'
import { ActorAvatarComponent } from '../shared-actor-image/actor-avatar.component'
import { AdvancedFilterDef } from '../shared-forms/advanced-input-filter.component'
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
import { TableColumnInfo, TableComponent } from '../shared-tables/table.component'
import { VideoCellComponent } from '../shared-tables/video-cell.component'
import { VideoCommentService } from '../shared-video-comment/video-comment.service'
import { AbuseDetailsComponent } from './abuse-details.component'
import { AbuseMessageModalComponent } from './abuse-message-modal.component'
import { ModerationCommentModalComponent } from './moderation-comment-modal.component'
import { ProcessedAbuse } from './processed-abuse.model'

const debugLogger = debug('peertube:moderation:AbuseListTableComponent')

type DataLoaderParameter = Parameters<AbuseListTableComponent['_dataLoader']>[0]

@Component({
  selector: 'my-abuse-list-table',
  templateUrl: './abuse-list-table.component.html',
  styleUrls: [ '../shared-moderation/moderation.scss', './abuse-list-table.component.scss' ],
  imports: [
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

  readonly table = viewChild<TableComponent<ProcessedAbuse, DataLoaderParameter>>('table')
  readonly abuseMessagesModal = viewChild<AbuseMessageModalComponent>('abuseMessagesModal')
  readonly moderationCommentModal = viewChild<ModerationCommentModalComponent>('moderationCommentModal')

  abuseActions: DropdownAction<ProcessedAbuse>[][] = []
  bulkActions: DropdownAction<ProcessedAbuse[]>[][] = []

  inputFilters: AdvancedFilterDef<DataLoaderParameter>[] = [
    {
      type: 'options',
      key: 'state',
      title: $localize`Report state`,
      options: [
        { value: 'all', label: $localize`All` },
        { value: AbuseState.PENDING, label: $localize`Unsolved reports` },
        { value: AbuseState.ACCEPTED, label: $localize`Accepted reports` },
        { value: AbuseState.REJECTED, label: $localize`Refused reports` }
      ]
    },
    {
      type: 'options',
      key: 'videoIs',
      title: $localize`Video status`,
      options: [
        { value: 'all', label: $localize`All` },
        { value: 'blacklisted', label: $localize`With blocked videos` },
        { value: 'deleted', label: $localize`With deleted videos` }
      ]
    },
    {
      type: 'select',
      title: $localize`Predefined reason`,
      key: 'predefinedReason',
      items: this.abuseService.getPredefinedReasons('all')
        .map(reason => ({ id: reason.id, label: reason.label }))
    },
    {
      type: 'text',
      key: 'searchReporter',
      title: $localize`Reporter`,
      placeholder: $localize`Search by reporter name...`
    },
    {
      type: 'text',
      key: 'searchReportee',
      title: $localize`Reportee`,
      placeholder: $localize`Search by reportee name...`
    },
    {
      type: 'text',
      constraint: 'numeric',
      key: 'id',
      title: $localize`Report ID`,
      placeholder: $localize`Search by report ID...`
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

    this.bulkActions = this.buildBulkActions()
  }

  ngOnDestroy () {
    if (this.viewType() === 'admin') {
      this.pluginService.removeAction('admin-abuse-list:load-data')
    }
  }

  isAdminView () {
    return this.viewType() === 'admin'
  }

  openModerationCommentModal (abuses: AdminAbuse[]) {
    this.moderationCommentModal().openModal(abuses)
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

  updateAbuseState (abuse: AdminAbuse, state: AbuseStateType) {
    this.abuseService.updateAbuse([ abuse ], { state })
      .subscribe({
        next: () => this.table().loadData(),

        error: err => this.notifier.handleError(err)
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

  private _dataLoader (options: Parameters<AbuseService['listAdminAbuses']>[0]) {
    debugLogger('Loading data.')

    const observable = this.viewType() === 'admin'
      ? this.abuseService.listAdminAbuses(options)
      : this.abuseService.listUserAbuses(options)

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
        handler: abuse => this.openModerationCommentModal([ abuse ]),
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
        handler: abuse => this.openModerationCommentModal([ abuse ]),
        isDisplayed: abuse => this.isAdminView() && !abuse.moderationComment
      },
      {
        label: $localize`Delete report`,
        handler: abuse => this.removeAbuses([ abuse ]),
        isDisplayed: () => this.isAdminView()
      }
    ]
  }

  private buildBulkActions (): DropdownAction<ProcessedAbuse[]>[][] {
    return [
      [
        {
          label: $localize`Update internal note`,
          handler: abuses => this.openModerationCommentModal(abuses),
          isDisplayed: abuses => this.isAdminView() && abuses.every(abuse => !!abuse.moderationComment)
        },
        {
          label: $localize`Mark as accepted`,
          handler: abuses => this.updateAbusesState(abuses, AbuseState.ACCEPTED),
          isDisplayed: abuses => this.isAdminView() && abuses.every(abuse => !this.isAbuseAccepted(abuse))
        },
        {
          label: $localize`Mark as rejected`,
          handler: abuses => this.updateAbusesState(abuses, AbuseState.REJECTED),
          isDisplayed: abuses => this.isAdminView() && abuses.every(abuse => !this.isAbuseRejected(abuse))
        },
        {
          label: $localize`Add internal note`,
          handler: abuses => this.openModerationCommentModal(abuses),
          isDisplayed: abuses => this.isAdminView() && abuses.every(abuse => !abuse.moderationComment)
        },
        {
          label: $localize`Delete report`,
          handler: abuses => this.removeAbuses(abuses),
          isDisplayed: () => this.isAdminView()
        }
      ],
      [
        {
          label: $localize`Mute account`,
          handler: abuses => this.muteFlaggedAccounts(abuses),
          isDisplayed: abuses => {
            return this.isAdminView() && abuses.every(abuse => abuse.flaggedAccount && !abuse.comment && !abuse.video)
          }
        },
        {
          label: $localize`Mute server account`,
          handler: abuses => this.muteFlaggedAccountServers(abuses),
          isDisplayed: abuses => {
            return this.isAdminView() && abuses.every(abuse => abuse.flaggedAccount && !abuse.comment && !abuse.video)
          }
        },
        {
          label: $localize`Mute reporter`,
          handler: abuses => this.muteReporters(abuses),
          isDisplayed: abuses => this.isAdminView() && abuses.every(abuse => !!abuse.reporterAccount)
        },
        {
          label: $localize`Mute reporter server`,
          handler: abuses => this.muteReporterServers(abuses),
          isDisplayed: abuses => {
            return this.isAdminView() && abuses.every(abuse => abuse.reporterAccount && !abuse.reporterAccount.userId)
          }
        }
      ],
      [
        {
          label: $localize`Block video`,
          handler: abuses => this.blockAbuseVideos(abuses),
          isDisplayed: abuses => {
            return this.isAdminView() && abuses.every(abuse => abuse.video && !abuse.video.deleted && !abuse.video.blacklisted)
          }
        },
        {
          label: $localize`Unblock video`,
          handler: abuses => this.unblockAbuseVideos(abuses),
          isDisplayed: abuses => {
            return this.isAdminView() && abuses.every(abuse => abuse.video && !abuse.video.deleted && abuse.video.blacklisted)
          }
        },
        {
          label: $localize`Delete video`,
          handler: abuses => this.deleteAbuseVideos(abuses),
          isDisplayed: abuses => this.isAdminView() && abuses.every(abuse => abuse.video && !abuse.video.deleted)
        },
        {
          label: $localize`Delete comment`,
          handler: abuses => this.deleteAbuseComments(abuses),
          isDisplayed: abuses => this.isAdminView() && abuses.every(abuse => abuse.comment && !abuse.comment.deleted)
        }
      ]
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
        handler: abuse => this.muteFlaggedAccounts([ abuse ])
      },

      {
        label: $localize`Mute server account`,
        isDisplayed: abuse => abuse.flaggedAccount && !abuse.comment && !abuse.video,
        handler: abuse => this.muteFlaggedAccountServers([ abuse ])
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
        handler: abuse => this.muteReporters([ abuse ])
      },

      {
        label: $localize`Mute server`,
        isDisplayed: abuse => abuse.reporterAccount && !abuse.reporterAccount.userId,
        handler: abuse => this.muteReporterServers([ abuse ])
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
        handler: abuse => this.blockAbuseVideos([ abuse ])
      },
      {
        label: $localize`Unblock video`,
        isDisplayed: abuse => abuse.video && !abuse.video.deleted && abuse.video.blacklisted,
        handler: abuse => this.unblockAbuseVideos([ abuse ])
      },
      {
        label: $localize`Delete video`,
        isDisplayed: abuse => abuse.video && !abuse.video.deleted,
        handler: abuse => this.deleteAbuseVideos([ abuse ])
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
        handler: abuse => this.deleteAbuseComments([ abuse ])
      }
    ]
  }

  private removeAbuses (abuses: AdminAbuse[]) {
    this.abuseService.removeAbuse(abuses)
      .subscribe({
        next: () => {
          this.notifier.success(
            formatICU(
              $localize`{count, plural, =1 {Abuse deleted.} other {{count} abuses deleted.}}`,
              { count: abuses.length }
            )
          )

          this.table().loadData()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private updateAbusesState (abuses: AdminAbuse[], state: AbuseStateType) {
    this.abuseService.updateAbuse(abuses, { state })
      .subscribe({
        next: () => {
          this.table().loadData()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private muteFlaggedAccounts (abuses: ProcessedAbuse[]) {
    const accounts = abuses.map(abuse => abuse.flaggedAccount)

    this.blocklistService.blockAccountByInstance(accounts)
      .subscribe({
        next: () => {
          this.notifier.success(
            formatICU(
              $localize`{count, plural, =1 {Flagged account muted.} other {{count} flagged accounts muted.}}`,
              { count: accounts.length }
            )
          )

          this.table().loadData()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private muteFlaggedAccountServers (abuses: ProcessedAbuse[]) {
    const hosts = abuses.map(abuse => abuse.flaggedAccount.host)

    this.blocklistService.blockServerByInstance(hosts)
      .subscribe({
        next: () => {
          this.notifier.success(
            formatICU(
              $localize`{count, plural, =1 {Flagged account server muted.} other {{count} flagged account servers muted.}}`,
              { count: hosts.length }
            )
          )

          this.table().loadData()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private muteReporters (abuses: ProcessedAbuse[]) {
    const accounts = abuses.map(abuse => abuse.reporterAccount)

    this.blocklistService.blockAccountByInstance(accounts)
      .subscribe({
        next: () => {
          this.notifier.success(
            formatICU(
              $localize`{count, plural, =1 {Reporter muted.} other {{count} reporters muted.}}`,
              { count: accounts.length }
            )
          )

          for (const account of accounts) {
            account.mutedByInstance = true
          }
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private muteReporterServers (abuses: ProcessedAbuse[]) {
    const hosts = abuses.map(abuse => abuse.reporterAccount.host)

    this.blocklistService.blockServerByInstance(hosts)
      .subscribe({
        next: () => {
          this.notifier.success(
            formatICU(
              $localize`{count, plural, =1 {Reporter server muted.} other {{count} reporter servers muted.}}`,
              { count: hosts.length }
            )
          )
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private blockAbuseVideos (abuses: ProcessedAbuse[]) {
    const videos = abuses.map(abuse => ({
      videoId: abuse.video.id,
      unfederate: abuse.video.channel.isLocal
    }))

    this.videoBlocklistService.blockVideos(videos)
      .subscribe({
        next: () => {
          this.notifier.success(
            formatICU(
              $localize`{count, plural, =1 {Video blocked.} other {{count} videos blocked.}}`,
              { count: videos.length }
            )
          )

          this.updateAbusesState(abuses, AbuseState.ACCEPTED)
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private unblockAbuseVideos (abuses: ProcessedAbuse[]) {
    const videoIds = abuses.map(abuse => abuse.video.id)

    this.videoBlocklistService.unblockVideos(videoIds)
      .subscribe({
        next: () => {
          this.notifier.success(
            formatICU(
              $localize`{count, plural, =1 {Video unblocked.} other {{count} videos unblocked.}}`,
              { count: videoIds.length }
            )
          )

          this.updateAbusesState(abuses, AbuseState.ACCEPTED)
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private async deleteAbuseVideos (abuses: ProcessedAbuse[]) {
    const res = await this.confirmService.confirm(
      formatICU(
        $localize`Do you really want to delete {count, plural, =1 {this video?} other {{count} videos?}}`,
        { count: abuses.length }
      ),
      $localize`Delete`
    )
    if (res === false) return

    this.videoService.removeVideo(abuses.map(abuse => abuse.video.id))
      .subscribe({
        next: () => {
          this.notifier.success(
            formatICU(
              $localize`{count, plural, =1 {Video deleted.} other {{count} videos deleted.}}`,
              { count: abuses.length }
            )
          )

          this.updateAbusesState(abuses, AbuseState.ACCEPTED)
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private async deleteAbuseComments (abuses: ProcessedAbuse[]) {
    const res = await this.confirmService.confirm(
      formatICU(
        $localize`Do you really want to delete {count, plural, =1 {this comment?} other {{count} comments?}}`,
        { count: abuses.length }
      ),
      $localize`Delete`
    )
    if (res === false) return

    this.commentService.deleteVideoComments(
      abuses.map(abuse => ({
        videoId: abuse.comment.video.id,
        commentId: abuse.comment.id
      }))
    )
      .subscribe({
        next: () => {
          this.notifier.success(
            formatICU(
              $localize`{count, plural, =1 {Comment deleted.} other {{count} comments deleted.}}`,
              { count: abuses.length }
            )
          )

          this.updateAbusesState(abuses, AbuseState.ACCEPTED)
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private toHtml (text: string) {
    return this.markdownRenderer.textMarkdownToHTML({ markdown: text })
  }
}
