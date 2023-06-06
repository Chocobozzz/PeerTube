import { SortMeta } from 'primeng/api'
import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, ConfirmService, MarkdownService, Notifier, RestPagination, RestTable } from '@app/core'
import { AdvancedInputFilter } from '@app/shared/shared-forms'
import { DropdownAction } from '@app/shared/shared-main'
import { BulkService } from '@app/shared/shared-moderation'
import { VideoCommentAdmin, VideoCommentService } from '@app/shared/shared-video-comment'
import { FeedFormat, UserRight } from '@shared/models'
import { formatICU } from '@app/helpers'

@Component({
  selector: 'my-video-comment-list',
  templateUrl: './video-comment-list.component.html',
  styleUrls: [ '../../../shared/shared-moderation/moderation.scss', './video-comment-list.component.scss' ]
})
export class VideoCommentListComponent extends RestTable <VideoCommentAdmin> implements OnInit {
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

  bulkActions: DropdownAction<VideoCommentAdmin[]>[] = []

  inputFilters: AdvancedInputFilter[] = [
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

    this.bulkActions = [
      {
        label: $localize`Delete`,
        handler: comments => this.removeComments(comments),
        isDisplayed: () => this.authUser.hasRight(UserRight.REMOVE_ANY_VIDEO_COMMENT),
        iconName: 'delete'
      }
    ]
  }

  getIdentifier () {
    return 'VideoCommentListComponent'
  }

  toHtml (text: string) {
    return this.markdownRenderer.textMarkdownToHTML({ markdown: text, withHtml: true, withEmoji: true })
  }

  protected reloadDataInternal () {
    this.videoCommentService.getAdminVideoComments({
      pagination: this.pagination,
      sort: this.sort,
      search: this.search
    }).subscribe({
      next: async resultList => {
        this.totalRecords = resultList.total

        this.comments = []

        for (const c of resultList.data) {
          this.comments.push(
            new VideoCommentAdmin(c, await this.toHtml(c.text))
          )
        }
      },

      error: err => this.notifier.error(err.message)
    })
  }

  private removeComments (comments: VideoCommentAdmin[]) {
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

  private deleteComment (comment: VideoCommentAdmin) {
    this.videoCommentService.deleteVideoComment(comment.video.id, comment.id)
      .subscribe({
        next: () => this.reloadData(),

        error: err => this.notifier.error(err.message)
      })
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
      .subscribe({
        next: () => {
          this.notifier.success($localize`Comments of ${options.accountName} will be deleted in a few minutes`)
        },

        error: err => this.notifier.error(err.message)
      })
  }
}
