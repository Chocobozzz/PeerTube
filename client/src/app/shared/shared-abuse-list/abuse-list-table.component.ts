import { Component, inject, input, OnDestroy, OnInit, viewChild } from '@angular/core'
import { ConfirmService, HooksService, MarkdownService, Notifier, PluginService } from '@app/core'
import { formatICU } from '@app/helpers'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { AbuseState, AbuseStateType, AdminAbuse, ResultList, UserAbuse } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import debug from 'debug'
import { map, switchMap } from 'rxjs'
import { ActorAvatarComponent } from '../shared-actor-image/actor-avatar.component'
import { AdvancedFilterDef } from '../shared-forms/advanced-input-filter.component'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { Account } from '../shared-main/account/account.model'
import { Actor } from '../shared-main/account/actor.model'
import { buildDropdownSimpleAndBulkActions, DropdownActionForBuilder } from '../shared-main/buttons/action-dropdown-helpers'
import { ActionDropdownComponent, DropdownAction } from '../shared-main/buttons/action-dropdown.component'
import { PTDatePipe } from '../shared-main/common/date.pipe'
import { NumberFormatterPipe } from '../shared-main/common/number-formatter.pipe'
import { Video } from '../shared-main/video/video.model'
import { VideoService } from '../shared-main/video/video.service'
import { AbuseService } from '../shared-moderation/abuse.service'
import { AccountBlockBadgesComponent } from '../shared-moderation/account-block-badges.component'
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
    NumberFormatterPipe,
    AccountBlockBadgesComponent
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

    const { simpleActions, bulkActions } = buildDropdownSimpleAndBulkActions<ProcessedAbuse>([
      this.buildInternalActions(),

      this.buildFlaggedAccountActions(),

      this.buildCommentActions(),

      this.buildVideoActions(),

      this.buildAccountActions()
    ])

    this.abuseActions = viewType === 'admin'
      ? await this.hooks.wrapObject(simpleActions, 'admin-comments', 'filter:admin-abuse-list.actions.create.result')
      : simpleActions

    this.bulkActions = bulkActions.filter(actions => actions.length !== 0)
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

    return observable.pipe(
      switchMap(async (resultList: ResultList<UserAbuse | AdminAbuse>) => {
        const abuses: ProcessedAbuse[] = []

        for (const abuse of resultList.data) {
          const video = abuse.video as ProcessedAbuse['video']

          if (abuse.video?.channel?.ownerAccount) {
            video.channel.ownerAccount = new Account(abuse.video.channel.ownerAccount)
          }

          let commentHTML: string

          if (abuse.comment) {
            if (abuse.comment.deleted) {
              commentHTML = $localize`Deleted comment`
            } else {
              commentHTML = await this.markdownRenderer.textMarkdownToHTML({
                markdown: abuse.comment.text,
                withHtml: true
              })
            }
          }

          if (abuse.updatedAt === abuse.createdAt) delete abuse.updatedAt

          abuses.push({
            ...abuse,

            video,

            commentHTML,

            reasonHtml: abuse.reason
              ? await this.toHtml(abuse.reason)
              : undefined,

            moderationCommentHtml: (abuse as AdminAbuse).moderationComment
              ? await this.toHtml((abuse as AdminAbuse).moderationComment)
              : undefined,

            reporterAccount: (abuse as AdminAbuse).reporterAccount
              ? new Account((abuse as AdminAbuse).reporterAccount)
              : undefined,

            flaggedAccount: abuse.flaggedAccount
              ? new Account(abuse.flaggedAccount)
              : undefined
          })
        }

        return { total: resultList.total, data: abuses }
      }),
      switchMap(({ data, total }) => {
        const accounts = data.map(abuse => abuse.reporterAccount)
          .concat(data.map(abuse => abuse.flaggedAccount))
          .filter((account): account is Account => !!account)

        const handlesSet = new Set(accounts.map(account => account.nameWithHostForced))
        const hostsSet = new Set(accounts.map(account => account.host).filter(host => !!host))

        return this.blocklistService.getStatus({ accounts: Array.from(handlesSet), hosts: Array.from(hostsSet) }).pipe(
          map(blockStatus => {
            for (const account of accounts) {
              account.mutedByInstance = blockStatus.accounts[account.nameWithHostForced].blockedByServer
              account.mutedServerByInstance = blockStatus.hosts[account.host].blockedByServer
            }

            return { total, data }
          })
        )
      })
    )
  }

  private buildInternalActions (): DropdownActionForBuilder<ProcessedAbuse>[] {
    const messagesAction: DropdownActionForBuilder<ProcessedAbuse> = {
      label: this.isAdminView()
        ? $localize`Messages with reporter`
        : $localize`Messages with moderators`,
      handler: abuses => this.openAbuseMessagesModal(abuses[0]),
      isDisplayed: abuse => this.isLocalAbuse(abuse),
      enableBulk: false
    }

    if (!this.isAdminView()) return [ messagesAction ]

    return [
      {
        label: () => $localize`Accept/Reject`,
        isHeader: true,
        enableBulk: true
      },

      {
        label: () => $localize`Mark as accepted`,
        handler: abuses => this.updateAbusesState(abuses, AbuseState.ACCEPTED),
        isDisplayed: abuse => this.isAdminView() && !this.isAbuseAccepted(abuse),
        enableBulk: true
      },
      {
        label: () => $localize`Mark as rejected`,
        handler: abuses => this.updateAbusesState(abuses, AbuseState.REJECTED),
        isDisplayed: abuse => this.isAdminView() && !this.isAbuseRejected(abuse),
        enableBulk: true
      },

      {
        label: () => $localize`Internal actions`,
        isHeader: true,
        enableBulk: true
      },

      messagesAction,

      {
        label: () => $localize`Set internal note`,
        handler: abuses => this.openModerationCommentModal(abuses),
        isDisplayed: () => this.isAdminView(),
        enableBulk: true
      },
      {
        label: abuses => formatICU($localize`{count, plural, =1 {Delete report} other {Delete reports}}`, { count: abuses.length }),
        handler: abuses => this.removeAbuses(abuses),
        isDisplayed: () => this.isAdminView(),
        enableBulk: true
      }
    ]
  }

  private buildFlaggedAccountActions (): DropdownActionForBuilder<ProcessedAbuse>[] {
    if (!this.isAdminView()) return []

    return [
      {
        label: entries => {
          return formatICU($localize`Actions for the flagged {count, plural, =1 {account} other {accounts}}`, { count: entries.length })
        },
        isHeader: true,
        isDisplayed: abuse => abuse.flaggedAccount && !abuse.comment && !abuse.video,
        enableBulk: true
      },

      {
        label: entries => formatICU($localize`Mute flagged {count, plural, =1 {account} other {accounts}}`, { count: entries.length }),
        isDisplayed: abuse => abuse.flaggedAccount && !abuse.comment && !abuse.video,
        handler: abuses => this.muteFlaggedAccounts(abuses),
        enableBulk: true
      },

      {
        label: entries => formatICU($localize`Mute flagged {count, plural, =1 {platform} other {platforms}}`, { count: entries.length }),
        isDisplayed: abuse => abuse.flaggedAccount && !abuse.comment && !abuse.video,
        handler: abuses => this.muteFlaggedAccountServers(abuses),
        enableBulk: true
      }
    ]
  }

  private buildAccountActions (): DropdownActionForBuilder<ProcessedAbuse>[] {
    if (!this.isAdminView()) return []

    return [
      {
        label: entries => formatICU($localize`Actions for the {count, plural, =1 {reporter} other {reporters}}`, { count: entries.length }),
        isHeader: true,
        isDisplayed: abuse => !!abuse.reporterAccount,
        enableBulk: true
      },

      {
        label: entries => formatICU($localize`Mute {count, plural, =1 {reporter} other {reporters}}`, { count: entries.length }),
        isDisplayed: abuse => !!abuse.reporterAccount,
        handler: abuses => this.muteReporters(abuses),
        enableBulk: true
      },

      {
        label: entries => formatICU($localize`Mute reporter {count, plural, =1 {platform} other {platforms}}`, { count: entries.length }),
        isDisplayed: abuse => abuse.reporterAccount && !abuse.reporterAccount.userId,
        handler: abuses => this.muteReporterServers(abuses),
        enableBulk: true
      }
    ]
  }

  private buildVideoActions (): DropdownActionForBuilder<ProcessedAbuse>[] {
    if (!this.isAdminView()) return []

    return [
      {
        label: entries => formatICU($localize`Actions for the {count, plural, =1 {video} other {videos}}`, { count: entries.length }),
        isHeader: true,
        isDisplayed: abuse => abuse.video && !abuse.video.deleted,
        enableBulk: true
      },
      {
        label: entries => formatICU($localize`Block the {count, plural, =1 {video} other {videos}}`, { count: entries.length }),
        isDisplayed: abuse => abuse.video && !abuse.video.deleted && !abuse.video.blacklisted,
        handler: abuses => this.blockAbuseVideos(abuses),
        enableBulk: true
      },
      {
        label: entries => formatICU($localize`Unblock the {count, plural, =1 {video} other {videos}}`, { count: entries.length }),
        isDisplayed: abuse => abuse.video && !abuse.video.deleted && abuse.video.blacklisted,
        handler: abuses => this.unblockAbuseVideos(abuses),
        enableBulk: true
      },
      {
        label: entries => formatICU($localize`Delete the {count, plural, =1 {video} other {videos}}`, { count: entries.length }),
        isDisplayed: abuse => abuse.video && !abuse.video.deleted,
        handler: abuses => this.deleteAbuseVideos(abuses),
        enableBulk: true
      }
    ]
  }

  private buildCommentActions (): DropdownActionForBuilder<ProcessedAbuse>[] {
    if (!this.isAdminView()) return []

    return [
      {
        label: entries => {
          return formatICU($localize`Actions for {count, plural, =1 {the comment} other {the comments}}`, { count: entries.length })
        },
        isHeader: true,
        isDisplayed: abuse => abuse.comment && !abuse.comment.deleted,
        enableBulk: true
      },

      {
        label: entries => formatICU($localize`Delete {count, plural, =1 {comment} other {comments}}`, { count: entries.length }),
        isDisplayed: abuse => abuse.comment && !abuse.comment.deleted,
        handler: abuses => this.deleteAbuseComments(abuses),
        enableBulk: true
      }
    ]
  }

  private async removeAbuses (abuses: AdminAbuse[]) {
    const message = formatICU(
      $localize`Do you really want to delete {count, plural, =1 {this report?} other {{count} reports?}}`,
      { count: abuses.length }
    )

    const res = await this.confirmService.confirm(message, $localize`Delete`)
    if (res === false) return

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

    this.commentService.deleteComments(
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
