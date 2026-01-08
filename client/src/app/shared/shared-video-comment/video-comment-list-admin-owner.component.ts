import { Component, OnDestroy, OnInit, inject, input, viewChild } from '@angular/core'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { AuthService, ConfirmService, HooksService, MarkdownService, Notifier, PluginService } from '@app/core'
import { formatICU } from '@app/helpers'
import { BulkService } from '@app/shared/shared-moderation/bulk.service'
import { VideoCommentForAdminOrUser } from '@app/shared/shared-video-comment/video-comment.model'
import { VideoCommentService } from '@app/shared/shared-video-comment/video-comment.service'
import { BulkRemoveCommentsOfBody, UserRight } from '@peertube/peertube-models'
import { switchMap } from 'rxjs'
import { ActorAvatarComponent } from '../shared-actor-image/actor-avatar.component'
import { AdvancedInputFilter, AdvancedInputFilterComponent } from '../shared-forms/advanced-input-filter.component'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { ActionDropdownComponent, DropdownAction } from '../shared-main/buttons/action-dropdown.component'
import { ButtonComponent } from '../shared-main/buttons/button.component'
import { CollaboratorStateComponent } from '../shared-main/channel/collaborator-state.component'
import { PTDatePipe } from '../shared-main/common/date.pipe'
import { NumberFormatterPipe } from '../shared-main/common/number-formatter.pipe'
import { DataLoaderOptions, TableColumnInfo, TableComponent } from '../shared-tables/table.component'

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
  imports: [
    ActionDropdownComponent,
    AdvancedInputFilterComponent,
    ButtonComponent,
    ActorAvatarComponent,
    PTDatePipe,
    RouterLink,
    TableComponent,
    NumberFormatterPipe,
    GlobalIconComponent,
    CollaboratorStateComponent
  ]
})
export class VideoCommentListAdminOwnerComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute)
  private auth = inject(AuthService)
  private notifier = inject(Notifier)
  private confirmService = inject(ConfirmService)
  private videoCommentService = inject(VideoCommentService)
  private markdownRenderer = inject(MarkdownService)
  private bulkService = inject(BulkService)
  private hooks = inject(HooksService)
  private pluginService = inject(PluginService)

  readonly key = input.required<string>()
  readonly mode = input.required<'user' | 'admin'>()

  readonly table = viewChild<TableComponent<VideoCommentForAdminOrUser, ColumnName>>('table')

  videoCommentActions: DropdownAction<VideoCommentForAdminOrUser>[][] = []
  bulkActions: DropdownAction<VideoCommentForAdminOrUser[]>[] = []
  inputFilters: AdvancedInputFilter[] = []

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
    await this.buildBulkActions()
  }

  ngOnDestroy () {
    if (this.mode() === 'admin') {
      this.pluginService.removeAction('admin-video-comment-list:load-data')
    }
  }

  private async buildCommentActions () {
    const videoCommentActions: DropdownAction<VideoCommentForAdminOrUser>[][] = [
      [
        {
          label: $localize`Delete this comment`,
          handler: comment => this.removeComment(comment),
          isDisplayed: () => this.mode() === 'user' || this.user.hasRight(UserRight.MANAGE_ANY_VIDEO_COMMENT)
        },
        {
          label: $localize`Delete all comments of this account`,

          description: this.mode() === 'user'
            ? this.user.isCollaboratingToChannels()
              ? $localize`Whether they're from channels you own or channels for which you're an editor`
              : $localize`This will delete comments on all your videos`
            : $localize`This will delete comments on all videos from your platform`,

          handler: comment => this.removeCommentsOfAccount(comment),
          isDisplayed: () => {
            if (this.mode() === 'user') return true

            return this.mode() === 'admin' && this.user.hasRight(UserRight.MANAGE_ANY_VIDEO_COMMENT)
          }
        }
      ],
      [
        {
          label: $localize`Approve this comment`,
          handler: comment => this.approveComments([ comment ]),
          isDisplayed: comment => this.mode() === 'user' && comment.heldForReview
        }
      ]
    ]

    this.videoCommentActions = this.mode() === 'admin'
      ? await this.hooks.wrapObject(videoCommentActions, 'admin-comments', 'filter:admin-video-comments-list.actions.create.result')
      : videoCommentActions
  }

  private async buildBulkActions () {
    const bulkActions: DropdownAction<VideoCommentForAdminOrUser[]>[] = [
      {
        label: $localize`Delete`,
        handler: comments => this.removeComments(comments),
        isDisplayed: () => this.mode() === 'user' || this.user.hasRight(UserRight.MANAGE_ANY_VIDEO_COMMENT),
        iconName: 'delete'
      },
      {
        label: $localize`Approve`,
        handler: comments => this.approveComments(comments),
        isDisplayed: comments => this.mode() === 'user' && comments.every(c => c.heldForReview),
        iconName: 'tick'
      }
    ]

    this.bulkActions = this.mode() === 'admin'
      ? await this.hooks.wrapObject(bulkActions, 'admin-comments', 'filter:admin-video-comments-list.bulk-actions.create.result')
      : bulkActions
  }

  private buildInputFilters () {
    if (this.mode() === 'admin') {
      this.inputFilters = [
        {
          title: $localize`Advanced filters`,
          children: [
            {
              value: 'local:true',
              label: $localize`Local comments`
            },
            {
              value: 'local:false',
              label: $localize`Remote comments`
            },
            {
              value: 'localVideo:true',
              label: $localize`Comments on local videos`
            }
          ]
        }
      ]

      return
    }

    this.inputFilters = [
      {
        title: $localize`Advanced filters`,
        children: [
          {
            value: 'heldForReview:true',
            label: $localize`Display comments awaiting your approval`
          }
        ]
      }
    ]
  }

  toHtml (text: string) {
    return this.markdownRenderer.textMarkdownToHTML({ markdown: text, withHtml: true, withEmoji: true })
  }

  buildSearchAutoTag (tag: string) {
    const str = `autoTag:"${tag}"`

    const search = this.route.snapshot.queryParams.search
    if (search) return search + ' ' + str

    return str
  }

  private _dataLoader (options: DataLoaderOptions) {
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

  private removeComments (comments: VideoCommentForAdminOrUser[]) {
    const commentArgs = comments.map(c => ({ videoId: c.video.id, commentId: c.id }))

    this.videoCommentService.deleteVideoComments(commentArgs)
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

  private removeComment (comment: VideoCommentForAdminOrUser) {
    this.videoCommentService.deleteVideoComment(comment.video.id, comment.id)
      .subscribe({
        next: () => this.table().loadData(),

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
}
