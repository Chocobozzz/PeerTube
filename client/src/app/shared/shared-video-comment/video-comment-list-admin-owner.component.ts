import { Component, OnDestroy, OnInit, inject, input, viewChild, ChangeDetectionStrategy } from '@angular/core'
import { RouterLink } from '@angular/router'
import { AuthService, ConfirmService, HooksService, MarkdownService, Notifier, PluginService } from '@app/core'
import { formatICU } from '@app/helpers'
import { BulkService } from '@app/shared/shared-moderation/bulk.service'
import { VideoCommentForAdminOrUser } from '@app/shared/shared-video-comment/video-comment.model'
import { VideoCommentService } from '@app/shared/shared-video-comment/video-comment.service'
import { BulkRemoveCommentsOfBody, UserRight } from '@peertube/peertube-models'
import { switchMap } from 'rxjs'
import { ActorAvatarComponent } from '../shared-actor-image/actor-avatar.component'
import { AdvancedFilterDef } from '../shared-forms/advanced-input-filter.component'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { buildDropdownSimpleAndBulkActions } from '../shared-main/buttons/action-dropdown-helpers'
import { ActionDropdownComponent, DropdownAction } from '../shared-main/buttons/action-dropdown.component'
import { CollaboratorStateComponent } from '../shared-main/channel/collaborator-state.component'
import { PTDatePipe } from '../shared-main/common/date.pipe'
import { NumberFormatterPipe } from '../shared-main/common/number-formatter.pipe'
import { AccountBlockBadgesComponent } from '../shared-moderation/account-block-badges.component'
import { BlocklistService } from '../shared-moderation/blocklist.service'
import { DataLoaderOptionsBase, TableColumnInfo, TableComponent } from '../shared-tables/table.component'

type DataLoaderParameter = Parameters<VideoCommentListAdminOwnerComponent['_dataLoader']>[0]

type ColumnName =
  | 'account'
  | 'video'
  | 'comment'
  | 'autoTags'
  | 'createdAt'

@Component({
  selector: 'my-video-comment-list-admin-owner',
  templateUrl: './video-comment-list-admin-owner.component.html',
  styleUrls: [ '../shared-moderation/moderation.scss', './video-comment-list-admin-owner.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    ActionDropdownComponent,
    ActorAvatarComponent,
    PTDatePipe,
    RouterLink,
    TableComponent,
    NumberFormatterPipe,
    GlobalIconComponent,
    CollaboratorStateComponent,
    AccountBlockBadgesComponent
  ]
})
export class VideoCommentListAdminOwnerComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService)
  private notifier = inject(Notifier)
  private confirmService = inject(ConfirmService)
  private videoCommentService = inject(VideoCommentService)
  private markdownRenderer = inject(MarkdownService)
  private bulkService = inject(BulkService)
  private hooks = inject(HooksService)
  private pluginService = inject(PluginService)
  private blocklist = inject(BlocklistService)

  readonly key = input.required<string>()
  readonly mode = input.required<'user' | 'admin'>()

  readonly table = viewChild<TableComponent<VideoCommentForAdminOrUser, DataLoaderParameter, ColumnName>>('table')

  videoCommentActions: DropdownAction<VideoCommentForAdminOrUser>[][] = []
  bulkActions: DropdownAction<VideoCommentForAdminOrUser[]>[][] = []
  inputFilters: AdvancedFilterDef<DataLoaderParameter>[] = []

  columns: TableColumnInfo<ColumnName>[] = [
    { id: 'video', label: $localize`Commented video`, sortable: false },
    { id: 'account', label: $localize`Account`, sortable: false },
    { id: 'comment', label: $localize`Comment`, sortable: false },
    { id: 'autoTags', label: $localize`Auto tags`, sortable: false },
    { id: 'createdAt', label: $localize`Date`, sortable: true }
  ]

  dataLoader: typeof this._dataLoader

  constructor () {
    this.dataLoader = this._dataLoader.bind(this)
  }

  get user () {
    return this.auth.getUser()
  }

  async ngOnInit () {
    if (this.mode() === 'admin') {
      this.pluginService.addAction('admin-video-comment-list:load-data', () => this.table().loadData())
    }

    this.buildInputFilters()

    await this.buildCommentActions()
  }

  ngOnDestroy () {
    if (this.mode() === 'admin') {
      this.pluginService.removeAction('admin-video-comment-list:load-data')
    }
  }

  private async buildCommentActions () {
    const { simpleActions, bulkActions } = buildDropdownSimpleAndBulkActions<VideoCommentForAdminOrUser>([
      [
        {
          label: $localize`Go to account page`,
          linkBuilder: comment => [ comment.account.localUrl ],
          isDisplayed: () => this.mode() === 'admin',
          enableBulk: false
        }
      ],
      [
        {
          label: comments => formatICU($localize`{count, plural, =1 {Delete comment} other {Delete comments}}`, { count: comments.length }),
          handler: comments => this.removeComments(comments),
          isDisplayed: () => this.mode() === 'user' || this.user.hasRight(UserRight.MANAGE_ANY_VIDEO_COMMENT),
          enableBulk: true
        },
        {
          label: $localize`Delete all comments of this account`,

          description: this.mode() === 'user'
            ? this.user.isCollaboratingToChannels()
              ? $localize`Whether they're from channels you own or channels for which you're an editor`
              : $localize`This will delete comments on all your videos`
            : $localize`This will delete comments on all videos from your platform`,

          handler: comments => this.removeCommentsOfAccount(comments[0]),

          isDisplayed: () => {
            if (this.mode() === 'user') return true

            return this.mode() === 'admin' && this.user.hasRight(UserRight.MANAGE_ANY_VIDEO_COMMENT)
          },

          enableBulk: false
        }
      ],
      [
        {
          label: comments => {
            return formatICU($localize`{count, plural, =1 {Approve comment} other {Approve comments}}`, { count: comments.length })
          },

          handler: comments => this.approveComments(comments),
          isDisplayed: comment => this.mode() === 'user' && comment.heldForReview,
          enableBulk: true
        }
      ],
      [
        {
          label: comments => {
            return formatICU(
              $localize`{count, plural, =1 {Mute account} other {Mute accounts}}`,
              { count: this.getUniqueAccounts(comments).length }
            )
          },

          handler: comments => this.muteAccount(comments),
          isDisplayed: comment => {
            return this.mode() === 'admin' &&
              comment.account &&
              !comment.account.mutedByInstance &&
              this.blocklist.canMuteAccountByInstance(this.user, comment.account)
          },

          enableBulk: true
        },
        {
          label: comments => {
            return formatICU(
              $localize`{count, plural, =1 {Unmute account} other {Unmute accounts}}`,
              { count: this.getUniqueAccounts(comments).length }
            )
          },
          handler: comments => this.unmuteAccount(comments),
          isDisplayed: comment => {
            return this.mode() === 'admin' &&
              comment.account &&
              comment.account.mutedByInstance &&
              this.blocklist.canMuteAccountByInstance(this.user, comment.account)
          },
          enableBulk: true
        },
        {
          label: comments => {
            return formatICU(
              $localize`{count, plural, =1 {Mute platform} other {Mute platforms}}`,
              { count: this.getUniqueHosts(comments).length }
            )
          },
          handler: comments => this.muteServer(comments),
          isDisplayed: comment => {
            return this.mode() === 'admin' &&
              comment.account &&
              !comment.account.mutedServerByInstance &&
              this.blocklist.canMutePlatformByInstance(this.user, comment.account)
          },
          enableBulk: true
        },
        {
          label: comments => {
            return formatICU(
              $localize`{count, plural, =1 {Unmute platform} other {Unmute platforms}}`,
              { count: this.getUniqueHosts(comments).length }
            )
          },
          handler: comments => this.unmuteServer(comments),
          isDisplayed: comment => {
            return this.mode() === 'admin' &&
              comment.account &&
              comment.account.mutedServerByInstance &&
              this.blocklist.canMutePlatformByInstance(this.user, comment.account)
          },
          enableBulk: true
        }
      ]
    ])

    this.videoCommentActions = this.mode() === 'admin'
      ? await this.hooks.wrapObject(simpleActions, 'admin-comments', 'filter:admin-video-comments-list.actions.create.result')
      : simpleActions

    this.bulkActions = this.mode() === 'admin'
      ? await this.hooks.wrapObject(bulkActions, 'admin-comments', 'filter:admin-video-comments-list.bulk-actions.create.result')
      : bulkActions
  }

  private buildInputFilters () {
    this.inputFilters = []

    if (this.mode() === 'admin') {
      this.inputFilters = [
        ...this.inputFilters,

        {
          type: 'options',
          key: 'isLocal',
          title: $localize`Comment scope`,
          options: [
            { value: 'all', label: $localize`All` },
            { value: true, label: $localize`Local` },
            { value: false, label: $localize`Remote` }
          ]
        },

        {
          type: 'title',
          title: $localize`Moderation`
        },
        {
          type: 'checkbox',
          key: 'excludeMuted',
          label: $localize`Exclude comments from muted accounts`
        },

        {
          type: 'title',
          title: $localize`Commented video scope`
        },
        {
          type: 'checkbox',
          key: 'onLocalVideo',
          label: $localize`Comments on local videos`
        }
      ]
    } else {
      this.inputFilters = [
        ...this.inputFilters,

        {
          type: 'title',
          title: $localize`Moderation`
        },

        {
          type: 'checkbox',
          key: 'isHeldForReview',
          label: $localize`Awaiting your approval`
        }
      ]
    }

    this.inputFilters = [
      ...this.inputFilters,

      {
        type: 'text',
        key: 'searchAccount',
        title: $localize`Search by account`
      },
      {
        type: 'text',
        key: 'searchVideo',
        title: $localize`Search by video`
      },
      {
        type: 'tags',
        key: 'autoTagOneOf',
        title: $localize`Search by auto tag`
      }
    ]
  }

  toHtml (text: string) {
    return this.markdownRenderer.textMarkdownToHTML({ markdown: text, withHtml: true, withEmoji: true })
  }

  private _dataLoader (
    options:
      & DataLoaderOptionsBase
      & Parameters<VideoCommentService['listAdminVideoComments']>[0]
      & Parameters<VideoCommentService['listVideoCommentsOfMyVideos']>[0]
  ) {
    const method = this.mode() === 'admin'
      ? this.videoCommentService.listAdminVideoComments.bind(this.videoCommentService)
      : this.videoCommentService.listVideoCommentsOfMyVideos.bind(this.videoCommentService)

    return method(options)
      .pipe(
        switchMap(async result => {
          const comments: VideoCommentForAdminOrUser[] = []

          for (const c of result.data) {
            comments.push(new VideoCommentForAdminOrUser(c, await this.toHtml(c.text)))
          }

          return {
            total: result.total,
            data: comments
          }
        })
      )
  }

  onDataLoaded () {
    if (this.mode() === 'admin') {
      this.loadBlockStatus()
    }
  }

  private loadBlockStatus () {
    const comments = this.table().data

    const accounts = this.getUniqueAccounts(comments)
    const hosts = this.getUniqueHosts(comments)

    this.blocklist.getStatus({ accounts: accounts.map(a => a.nameWithHostForced), hosts })
      .subscribe(status => {
        for (const a of accounts) {
          a.mutedByInstance = status.accounts[a.nameWithHostForced].blockedByServer
          a.mutedServerByInstance = status.hosts[a.host].blockedByServer
        }
      })
  }

  private approveComments (comments: VideoCommentForAdminOrUser[]) {
    const commentArgs = comments.map(c => ({ videoId: c.video.id, commentId: c.id }))

    this.videoCommentService.approveComments(commentArgs)
      .subscribe({
        next: () => {
          this.notifier.success(
            formatICU(
              $localize`{count, plural, =1 {Comment approved.} other {{count} comments approved.}}`,
              { count: commentArgs.length }
            )
          )

          this.table().loadData()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private async removeComments (comments: VideoCommentForAdminOrUser[]) {
    const message = formatICU(
      $localize`Do you really want to remove {count, plural, =1 {this comment} other {{count} comments}}?`,
      { count: comments.length }
    )

    const res = await this.confirmService.confirm(message, $localize`Remove`)
    if (res === false) return

    const commentArgs = comments.map(c => ({ videoId: c.video.id, commentId: c.id }))

    this.videoCommentService.deleteComments(commentArgs)
      .subscribe({
        next: () => {
          this.notifier.success(
            formatICU(
              $localize`{count, plural, =1 {1 comment deleted.} other {{count} comments deleted.}}`,
              { count: commentArgs.length }
            )
          )

          this.table().loadData()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private async removeCommentsOfAccount (comment: VideoCommentForAdminOrUser) {
    const message = $localize`Do you really want to delete all comments of ${comment.by}? Comments are deleted after a few minutes.`
    const res = await this.confirmService.confirm(message, $localize`Delete`)
    if (res === false) return

    const options: BulkRemoveCommentsOfBody = {
      accountName: comment.by,
      scope: this.mode() === 'admin'
        ? 'instance'
        : 'my-videos-and-collaborations'
    }

    this.bulkService.removeCommentsOf(options)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Comments of ${options.accountName} will be deleted in a few minutes`)
        },

        error: err => this.notifier.handleError(err)
      })
  }

  // ---------------------------------------------------------------------------
  // Block/unblock accounts and servers
  // ---------------------------------------------------------------------------

  private muteAccount (comments: VideoCommentForAdminOrUser[]) {
    const accounts = this.getUniqueAccounts(comments)
      .map(account => ({ nameWithHost: account.name + '@' + account.host }))

    this.blocklist.blockAccountByInstanceAndNotify(accounts)
      .subscribe({
        next: () => {
          this.loadBlockStatus()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private unmuteAccount (comments: VideoCommentForAdminOrUser[]) {
    const accounts = this.getUniqueAccounts(comments)
      .map(account => ({ nameWithHost: account.name + '@' + account.host }))

    this.blocklist.unblockAccountByInstanceAndNotify(accounts)
      .subscribe({
        next: () => {
          this.loadBlockStatus()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private muteServer (comments: VideoCommentForAdminOrUser[]) {
    const hosts = this.getUniqueHosts(comments)

    this.blocklist.blockServerByInstanceAndNotify(hosts)
      .subscribe({
        next: () => {
          this.loadBlockStatus()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private unmuteServer (comments: VideoCommentForAdminOrUser[]) {
    const hosts = this.getUniqueHosts(comments)

    this.blocklist.unblockServerByInstanceAndNotify(hosts)
      .subscribe({
        next: () => {
          this.loadBlockStatus()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private getUniqueAccounts (comments: VideoCommentForAdminOrUser[]) {
    const accountsDone = new Set<number>()

    return comments
      .map(a => {
        if (!a.account || accountsDone.has(a.account.id)) return null

        accountsDone.add(a.account.id)
        return a.account
      }).filter(a => !!a)
  }

  private getUniqueHosts (comments: VideoCommentForAdminOrUser[]) {
    return Array.from(new Set(comments.map(c => c.account?.host).filter(h => !!h)))
  }
}
