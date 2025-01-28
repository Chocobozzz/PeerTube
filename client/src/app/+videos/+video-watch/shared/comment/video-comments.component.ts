import { NgFor, NgIf } from '@angular/common'
import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AuthService, ComponentPagination, ConfirmService, hasMoreItems, Notifier, PluginService, User } from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { Syndication } from '@app/shared/shared-main/feeds/syndication.model'
import { VideoDetails } from '@app/shared/shared-main/video/video-details.model'
import { VideoCommentThreadTree } from '@app/shared/shared-video-comment/video-comment-thread-tree.model'
import { VideoComment } from '@app/shared/shared-video-comment/video-comment.model'
import { VideoCommentService } from '@app/shared/shared-video-comment/video-comment.service'
import { NgbDropdown, NgbDropdownButtonItem, NgbDropdownItem, NgbDropdownMenu, NgbDropdownToggle } from '@ng-bootstrap/ng-bootstrap'
import { PeerTubeProblemDocument, ServerErrorCode, VideoCommentPolicy } from '@peertube/peertube-models'
import { lastValueFrom, Subject, Subscription } from 'rxjs'
import { InfiniteScrollerDirective } from '../../../../shared/shared-main/common/infinite-scroller.directive'
import { LoaderComponent } from '../../../../shared/shared-main/common/loader.component'
import { FeedComponent } from '../../../../shared/shared-main/feeds/feed.component'
import { VideoCommentAddComponent } from './video-comment-add.component'
import { VideoCommentComponent } from './video-comment.component'

@Component({
  selector: 'my-video-comments',
  templateUrl: './video-comments.component.html',
  styleUrls: [ './video-comments.component.scss' ],
  standalone: true,
  imports: [
    FeedComponent,
    NgbDropdown,
    NgbDropdownToggle,
    NgbDropdownMenu,
    NgbDropdownButtonItem,
    NgbDropdownItem,
    NgIf,
    VideoCommentAddComponent,
    InfiniteScrollerDirective,
    VideoCommentComponent,
    NgFor,
    LoaderComponent
  ]
})
export class VideoCommentsComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild('commentHighlightBlock') commentHighlightBlock: ElementRef
  @Input() video: VideoDetails
  @Input() videoPassword: string
  @Input() user: User

  @Output() timestampClicked = new EventEmitter<number>()

  comments: VideoComment[] = []
  highlightedThread: VideoComment

  sort = '-createdAt'

  componentPagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: null
  }
  totalNotDeletedComments: number

  inReplyToCommentId: number
  commentReplyRedraftValue: string
  commentThreadRedraftValue: string

  commentsEnabled: boolean

  threadComments: { [ id: number ]: VideoCommentThreadTree } = {}
  threadLoading: { [ id: number ]: boolean } = {}

  syndicationItems: Syndication[] = []

  onDataSubject = new Subject<any[]>()

  private sub: Subscription

  constructor (
    private authService: AuthService,
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private videoCommentService: VideoCommentService,
    private activatedRoute: ActivatedRoute,
    private hooks: HooksService,
    private pluginService: PluginService
  ) {}

  ngOnInit () {
    this.pluginService.addAction('video-watch-comment-list:load-data', () => this.loadMoreThreads(true))

    // Find highlighted comment in params
    this.sub = this.activatedRoute.params.subscribe(
      params => {
        if (params['threadId']) {
          const highlightedThreadId = +params['threadId']
          this.processHighlightedThread(highlightedThreadId)
        }
      }
    )
  }

  ngOnChanges (changes: SimpleChanges) {
    if (changes['video']) {
      this.resetVideo()
    }
  }

  ngOnDestroy () {
    this.pluginService.removeAction('video-watch-comment-list:load-data')

    if (this.sub) this.sub.unsubscribe()
  }

  viewReplies (commentId: number, highlightThread = false) {
    this.threadLoading[commentId] = true

    const params = {
      videoId: this.video.uuid,
      threadId: commentId,
      videoPassword: this.videoPassword
    }

    const obs = this.hooks.wrapObsFun(
      this.videoCommentService.getVideoThreadComments.bind(this.videoCommentService),
      params,
      'video-watch',
      'filter:api.video-watch.video-thread-replies.list.params',
      'filter:api.video-watch.video-thread-replies.list.result'
    )

    obs.subscribe({
      next: res => {
        this.threadComments[commentId] = res
        this.threadLoading[commentId] = false
        this.hooks.runAction('action:video-watch.video-thread-replies.loaded', 'video-watch', { data: res })

        if (highlightThread) {
          this.highlightedThread = new VideoComment(res.comment)

          // Scroll to the highlighted thread
          setTimeout(() => this.commentHighlightBlock.nativeElement.scrollIntoView(), 0)
        }
      },

      error: err => {
        // We may try to fetch highlighted thread of another video, skip the error if it is the case
        // We'll retry the request on video Input() change
        const errorBody = err.body as PeerTubeProblemDocument
        if (highlightThread && errorBody?.code === ServerErrorCode.COMMENT_NOT_ASSOCIATED_TO_VIDEO) return

        this.notifier.error(err.message)
      }
    })
  }

  async loadMoreThreads (reset = false) {
    if (reset === true) {
      this.componentPagination.currentPage = 1
    }

    const params = {
      videoId: this.video.uuid,
      videoPassword: this.videoPassword,
      componentPagination: this.componentPagination,
      sort: this.sort
    }

    const obs = this.hooks.wrapObsFun(
      this.videoCommentService.getVideoCommentThreads.bind(this.videoCommentService),
      params,
      'video-watch',
      'filter:api.video-watch.video-threads.list.params',
      'filter:api.video-watch.video-threads.list.result'
    )

    try {
      const res = await lastValueFrom(obs)

      if (reset) this.comments = []
      this.comments = this.comments.concat(res.data)
      this.componentPagination.totalItems = res.total
      this.totalNotDeletedComments = res.totalNotDeletedComments

      this.onDataSubject.next(res.data)

      this.hooks.runAction('action:video-watch.video-threads.loaded', 'video-watch', { data: this.componentPagination })
    } catch (err) {
      this.notifier.error(err.message)
    }
  }

  onCommentThreadCreated (comment: VideoComment) {
    this.comments.unshift(comment)
    this.commentThreadRedraftValue = undefined
  }

  onWantedToReply (comment: VideoComment) {
    this.inReplyToCommentId = comment.id
  }

  onResetReply () {
    this.inReplyToCommentId = undefined
    this.commentReplyRedraftValue = undefined
  }

  onThreadCreated (commentTree: VideoCommentThreadTree) {
    this.viewReplies(commentTree.comment.id)
  }

  handleSortChange (sort: string) {
    if (this.sort === sort) return

    this.sort = sort
    this.resetVideo()
  }

  handleTimestampClicked (timestamp: number) {
    this.timestampClicked.emit(timestamp)
  }

  async onWantedToDelete (
    commentToDelete: VideoComment,
    title = $localize`Delete`,
    message = $localize`Do you really want to delete this comment?`
  ): Promise<boolean> {
    if (commentToDelete.isLocal || this.video.isLocal) {
      message += $localize` The deletion will be sent to remote instances so they can reflect the change.`
    } else {
      message += $localize` It is a remote comment, so the deletion will only be effective on your instance.`
    }

    const res = await this.confirmService.confirm(message, title)
    if (res === false) return false

    this.videoCommentService.deleteVideoComment(commentToDelete.videoId, commentToDelete.id)
      .subscribe({
        next: () => {
          if (this.highlightedThread?.id === commentToDelete.id) {
            commentToDelete = this.comments.find(c => c.id === commentToDelete.id)

            this.highlightedThread = undefined
          }

          // Mark the comment as deleted
          this.softDeleteComment(commentToDelete)
        },

        error: err => this.notifier.error(err.message)
      })

    return true
  }

  async onWantedToRedraft (commentToRedraft: VideoComment) {
    const confirm = await this.onWantedToDelete(
      commentToRedraft,
      $localize`Delete and re-draft`,
      $localize`Do you really want to delete and re-draft this comment?`
    )

    if (confirm) {
      this.inReplyToCommentId = commentToRedraft.inReplyToCommentId

      // Restore line feed for editing
      const commentToRedraftText = commentToRedraft.text.replace(/<br.?\/?>/g, '\r\n')

      if (commentToRedraft.threadId === commentToRedraft.id) {
        this.commentThreadRedraftValue = commentToRedraftText
      } else {
        this.commentReplyRedraftValue = commentToRedraftText
      }

    }
  }

  onWantToApprove (comment: VideoComment) {
    this.videoCommentService.approveComments([ { commentId: comment.id, videoId: comment.videoId } ])
      .subscribe({
        next: () => {
          comment.heldForReview = false

          this.notifier.success($localize`Comment approved`)
        },

        error: err => this.notifier.error(err.message)
      })
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  onNearOfBottom () {
    if (hasMoreItems(this.componentPagination)) {
      this.componentPagination.currentPage++
      this.loadMoreThreads()
    }
  }

  private softDeleteComment (comment: VideoComment) {
    comment.isDeleted = true
    comment.deletedAt = new Date()
    comment.text = ''
    comment.account = null
  }

  private resetVideo () {
    if (this.video.commentsPolicy.id === VideoCommentPolicy.DISABLED) return

    // Reset all our fields
    this.highlightedThread = null
    this.comments = []
    this.threadComments = {}
    this.threadLoading = {}
    this.inReplyToCommentId = undefined
    this.componentPagination.currentPage = 1
    this.componentPagination.totalItems = null
    this.totalNotDeletedComments = null

    this.commentsEnabled = true

    this.syndicationItems = this.videoCommentService.getVideoCommentsFeeds(this.video)
    this.loadMoreThreads()

    if (this.activatedRoute.snapshot.params['threadId']) {
      this.processHighlightedThread(+this.activatedRoute.snapshot.params['threadId'])
    }
  }

  private processHighlightedThread (highlightedThreadId: number) {
    this.highlightedThread = this.comments.find(c => c.id === highlightedThreadId)

    const highlightThread = true
    this.viewReplies(highlightedThreadId, highlightThread)
  }
}
