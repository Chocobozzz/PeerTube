import { NgClass, NgIf } from '@angular/common'
import { Component, Input, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { AuthService, ConfirmService, HooksService, MarkdownService, Notifier, PluginService, RestPagination, RestTable } from '@app/core'
import { formatICU } from '@app/helpers'
import { BulkService } from '@app/shared/shared-moderation/bulk.service'
import { VideoCommentForAdminOrUser } from '@app/shared/shared-video-comment/video-comment.model'
import { VideoCommentService } from '@app/shared/shared-video-comment/video-comment.service'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { UserRight } from '@peertube/peertube-models'
import { SharedModule, SortMeta } from 'primeng/api'
import { TableModule } from 'primeng/table'
import { lastValueFrom } from 'rxjs'
import { ActorAvatarComponent } from '../shared-actor-image/actor-avatar.component'
import { AdvancedInputFilter, AdvancedInputFilterComponent } from '../shared-forms/advanced-input-filter.component'
import { ActionDropdownComponent, DropdownAction } from '../shared-main/buttons/action-dropdown.component'
import { ButtonComponent } from '../shared-main/buttons/button.component'
import { AutoColspanDirective } from '../shared-main/common/auto-colspan.directive'
import { PTDatePipe } from '../shared-main/common/date.pipe'
import { TableExpanderIconComponent } from '../shared-tables/table-expander-icon.component'

@Component({
  selector: 'my-video-comment-list-admin-owner',
  templateUrl: './video-comment-list-admin-owner.component.html',
  styleUrls: [ '../shared-moderation/moderation.scss', './video-comment-list-admin-owner.component.scss' ],
  standalone: true,
  imports: [
    TableModule,
    SharedModule,
    NgIf,
    ActionDropdownComponent,
    AdvancedInputFilterComponent,
    ButtonComponent,
    NgbTooltip,
    TableExpanderIconComponent,
    NgClass,
    ActorAvatarComponent,
    AutoColspanDirective,
    PTDatePipe,
    RouterLink
  ]
})
export class VideoCommentListAdminOwnerComponent extends RestTable <VideoCommentForAdminOrUser> implements OnInit, OnDestroy {
  @Input({ required: true }) mode: 'user' | 'admin'

  comments: VideoCommentForAdminOrUser[]
  totalRecords = 0
  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  videoCommentActions: DropdownAction<VideoCommentForAdminOrUser>[][] = []

  bulkActions: DropdownAction<VideoCommentForAdminOrUser[]>[] = []

  inputFilters: AdvancedInputFilter[] = []

  get authUser () {
    return this.auth.getUser()
  }

  constructor (
    protected router: Router,
    protected route: ActivatedRoute,
    private auth: AuthService,
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private videoCommentService: VideoCommentService,
    private markdownRenderer: MarkdownService,
    private bulkService: BulkService,
    private hooks: HooksService,
    private pluginService: PluginService
  ) {
    super()
  }

  async ngOnInit () {
    this.initialize()

    if (this.mode === 'admin') {
      this.pluginService.addAction('admin-video-comment-list:load-data', () => this.reloadDataInternal())
    }

    this.buildInputFilters()

    await this.buildCommentActions()
    await this.buildBulkActions()
  }

  ngOnDestroy () {
    if (this.mode === 'admin') {
      this.pluginService.removeAction('admin-video-comment-list:load-data')
    }
  }

  private async buildCommentActions () {
    const videoCommentActions: DropdownAction<VideoCommentForAdminOrUser>[][] = [
      [
        {
          label: $localize`Delete this comment`,
          handler: comment => this.removeComment(comment),
          isDisplayed: () => this.mode === 'user' || this.authUser.hasRight(UserRight.MANAGE_ANY_VIDEO_COMMENT)
        },
        {
          label: $localize`Delete all comments of this account`,
          description: $localize`Comments are deleted after a few minutes`,
          handler: comment => this.removeCommentsOfAccount(comment),
          isDisplayed: () => this.mode === 'admin' && this.authUser.hasRight(UserRight.MANAGE_ANY_VIDEO_COMMENT)
        }
      ],
      [
        {
          label: $localize`Approve this comment`,
          handler: comment => this.approveComments([ comment ]),
          isDisplayed: comment => this.mode === 'user' && comment.heldForReview
        }
      ]
    ]

    this.videoCommentActions = this.mode === 'admin'
      ? await this.hooks.wrapObject(videoCommentActions, 'admin-comments', 'filter:admin-video-comments-list.actions.create.result')
      : videoCommentActions
  }

  private async buildBulkActions () {
    const bulkActions: DropdownAction<VideoCommentForAdminOrUser[]>[] = [
      {
        label: $localize`Delete`,
        handler: comments => this.removeComments(comments),
        isDisplayed: () => this.mode === 'user' || this.authUser.hasRight(UserRight.MANAGE_ANY_VIDEO_COMMENT),
        iconName: 'delete'
      },
      {
        label: $localize`Approve`,
        handler: comments => this.approveComments(comments),
        isDisplayed: comments => this.mode === 'user' && comments.every(c => c.heldForReview),
        iconName: 'tick'
      }
    ]

    this.bulkActions = this.mode === 'admin'
      ? await this.hooks.wrapObject(bulkActions, 'admin-comments', 'filter:admin-video-comments-list.bulk-actions.create.result')
      : bulkActions
  }

  private buildInputFilters () {
    if (this.mode === 'admin') {
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

  getIdentifier () {
    return 'VideoCommentListAdminOwnerComponent'
  }

  toHtml (text: string) {
    return this.markdownRenderer.textMarkdownToHTML({ markdown: text, withHtml: true, withEmoji: true })
  }

  buildSearchAutoTag (tag: string) {
    const str = `autoTag:"${tag}"`

    if (this.search) return this.search + ' ' + str

    return str
  }

  protected async reloadDataInternal () {
    const method = this.mode === 'admin'
      ? this.videoCommentService.listAdminVideoComments.bind(this.videoCommentService)
      : this.videoCommentService.listVideoCommentsOfMyVideos.bind(this.videoCommentService)

    const obs = method({ pagination: this.pagination, sort: this.sort, search: this.search })

    try {
      const resultList = await lastValueFrom(obs)

      this.totalRecords = resultList.total

      this.comments = []

      for (const c of resultList.data) {
        this.comments.push(new VideoCommentForAdminOrUser(c, await this.toHtml(c.text)))
      }
    } catch (err) {
      this.notifier.error(err.message)
    }
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

          this.reloadData()
        },

        error: err => this.notifier.error(err.message),

        complete: () => this.selectedRows = []
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

          this.reloadData()
        },

        error: err => this.notifier.error(err.message),

        complete: () => this.selectedRows = []
      })
  }

  private removeComment (comment: VideoCommentForAdminOrUser) {
    this.videoCommentService.deleteVideoComment(comment.video.id, comment.id)
      .subscribe({
        next: () => this.reloadData(),

        error: err => this.notifier.error(err.message)
      })
  }

  private async removeCommentsOfAccount (comment: VideoCommentForAdminOrUser) {
    const message = $localize`Do you really want to delete all comments of ${comment.by}?`
    const res = await this.confirmService.confirm(message, $localize`Delete`)
    if (res === false) return

    const options = {
      accountName: comment.by,
      scope: 'instance' as 'instance'
    }

    this.bulkService.removeCommentsOf(options)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Comments of ${options.accountName} will be deleted in a few minutes`)
        },

        error: err => this.notifier.error(err.message)
      })
  }
}
