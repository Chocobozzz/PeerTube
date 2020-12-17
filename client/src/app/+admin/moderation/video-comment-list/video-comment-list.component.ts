import { SortMeta } from 'primeng/api'
import { AfterViewInit, Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, ConfirmService, MarkdownService, Notifier, RestPagination, RestTable } from '@app/core'
import { DropdownAction } from '@app/shared/shared-main'
import { BulkService } from '@app/shared/shared-moderation'
import { VideoCommentAdmin, VideoCommentService } from '@app/shared/shared-video-comment'
import { FeedFormat, UserRight } from '@shared/models'

@Component({
  selector: 'my-video-comment-list',
  templateUrl: './video-comment-list.component.html',
  styleUrls: [ '../../../shared/shared-moderation/moderation.scss', './video-comment-list.component.scss' ]
})
export class VideoCommentListComponent extends RestTable implements OnInit, AfterViewInit {
  baseRoute = '/admin/moderation/video-comments/list'

  comments: VideoCommentAdmin[]
  totalRecords = 0
  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  videoCommentActions: DropdownAction<VideoCommentAdmin>[][] = []

  syndicationItems = [
    {
      format: FeedFormat.RSS,
      label: 'media rss 2.0',
      url: VideoCommentService.BASE_FEEDS_URL + FeedFormat.RSS.toLowerCase()
    },
    {
      format: FeedFormat.ATOM,
      label: 'atom 1.0',
      url: VideoCommentService.BASE_FEEDS_URL + FeedFormat.ATOM.toLowerCase()
    },
    {
      format: FeedFormat.JSON,
      label: 'json 1.0',
      url: VideoCommentService.BASE_FEEDS_URL + FeedFormat.JSON.toLowerCase()
    }
  ]

  selectedComments: VideoCommentAdmin[] = []
  bulkCommentActions: DropdownAction<VideoCommentAdmin[]>[] = []

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
    private bulkService: BulkService
    ) {
    super()

    this.videoCommentActions = [
      [
        {
          label: $localize`Delete this comment`,
          handler: comment => this.deleteComment(comment),
          isDisplayed: () => this.authUser.hasRight(UserRight.REMOVE_ANY_VIDEO_COMMENT)
        },

        {
          label: $localize`Delete all comments of this account`,
          description: $localize`Comments are deleted after a few minutes`,
          handler: comment => this.deleteUserComments(comment),
          isDisplayed: () => this.authUser.hasRight(UserRight.REMOVE_ANY_VIDEO_COMMENT)
        }
      ]
    ]
  }

  ngOnInit () {
    this.initialize()
    this.listenToSearchChange()

    this.bulkCommentActions = [
      {
        label: $localize`Delete`,
        handler: comments => this.removeComments(comments),
        isDisplayed: () => this.authUser.hasRight(UserRight.REMOVE_ANY_VIDEO_COMMENT),
        iconName: 'delete'
      }
    ]
  }

  ngAfterViewInit () {
    if (this.search) this.setTableFilter(this.search, false)
  }

  getIdentifier () {
    return 'VideoCommentListComponent'
  }

  toHtml (text: string) {
    return this.markdownRenderer.textMarkdownToHTML(text, true, true)
  }

  isInSelectionMode () {
    return this.selectedComments.length !== 0
  }

  protected loadData () {
    this.videoCommentService.getAdminVideoComments({
      pagination: this.pagination,
      sort: this.sort,
      search: this.search
    }).subscribe(
        async resultList => {
          this.totalRecords = resultList.total

          this.comments = []

          for (const c of resultList.data) {
            this.comments.push(
              new VideoCommentAdmin(c, await this.toHtml(c.text))
            )
          }
        },

        err => this.notifier.error(err.message)
      )
  }

  private async removeComments (comments: VideoCommentAdmin[]) {
    const commentArgs = comments.map(c => ({ videoId: c.video.id, commentId: c.id }))

    this.videoCommentService.deleteVideoComments(commentArgs).subscribe(
      () => {
        this.notifier.success($localize`${commentArgs.length} comments deleted.`)
        this.loadData()
      },

      err => this.notifier.error(err.message),

      () => this.selectedComments = []
    )
  }

  private deleteComment (comment: VideoCommentAdmin) {
    this.videoCommentService.deleteVideoComment(comment.video.id, comment.id)
      .subscribe(
        () => this.loadData(),

        err => this.notifier.error(err.message)
      )
  }

  private async deleteUserComments (comment: VideoCommentAdmin) {
    const message = $localize`Do you really want to delete all comments of ${comment.by}?`
    const res = await this.confirmService.confirm(message, $localize`Delete`)
    if (res === false) return

    const options = {
      accountName: comment.by,
      scope: 'instance' as 'instance'
    }

    this.bulkService.removeCommentsOf(options)
      .subscribe(
        () => {
          this.notifier.success($localize`Comments of ${options.accountName} will be deleted in a few minutes`)
        },

        err => this.notifier.error(err.message)
      )
  }
}
