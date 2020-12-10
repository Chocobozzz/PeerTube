import { Subject, Subscription } from 'rxjs'
import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AuthService, ComponentPagination, ConfirmService, hasMoreItems, Notifier, User } from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { Syndication, VideoDetails } from '@app/shared/shared-main'
import { VideoComment, VideoCommentService, VideoCommentThreadTree } from '@app/shared/shared-video-comment'
import { ThisReceiver } from '@angular/compiler'

@Component({
  selector: 'my-video-comments',
  templateUrl: './video-comments.component.html',
  styleUrls: ['./video-comments.component.scss']
})
export class VideoCommentsComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild('commentHighlightBlock') commentHighlightBlock: ElementRef
  @Input() video: VideoDetails
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
  inReplyToCommentId: number
  commentReplyRedraftValue: string
  commentThreadRedraftValue: string
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
    private hooks: HooksService
  ) {}

  ngOnInit () {
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
    if (this.sub) this.sub.unsubscribe()
  }

  viewReplies (commentId: number, highlightThread = false) {
    this.threadLoading[commentId] = true

    const params = {
      videoId: this.video.id,
      threadId: commentId
    }

    const obs = this.hooks.wrapObsFun(
      this.videoCommentService.getVideoThreadComments.bind(this.videoCommentService),
      params,
      'video-watch',
      'filter:api.video-watch.video-thread-replies.list.params',
      'filter:api.video-watch.video-thread-replies.list.result'
    )

    obs.subscribe(
        res => {
          this.threadComments[commentId] = res
          this.threadLoading[commentId] = false
          this.hooks.runAction('action:video-watch.video-thread-replies.loaded', 'video-watch', { data: res })

          if (highlightThread) {
            this.highlightedThread = new VideoComment(res.comment)

            // Scroll to the highlighted thread
            setTimeout(() => this.commentHighlightBlock.nativeElement.scrollIntoView(), 0)
          }
        },

        err => this.notifier.error(err.message)
      )
  }

  loadMoreThreads () {
    const params = {
      videoId: this.video.id,
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

    obs.subscribe(
      res => {
        this.comments = this.comments.concat(res.data)
        // Client does not display removed comments
        this.componentPagination.totalItems = res.total - this.comments.filter(c => c.isDeleted).length

        this.onDataSubject.next(res.data)
        this.hooks.runAction('action:video-watch.video-threads.loaded', 'video-watch', { data: this.componentPagination })
      },

      err => this.notifier.error(err.message)
    )
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
      .subscribe(
        () => {
          if (this.highlightedThread?.id === commentToDelete.id) {
            commentToDelete = this.comments.find(c => c.id === commentToDelete.id)

            this.highlightedThread = undefined
          }

          // Mark the comment as deleted
          this.softDeleteComment(commentToDelete)
        },

        err => this.notifier.error(err.message)
      )

    return true
  }

  async onWantedToRedraft (commentToRedraft: VideoComment) {
    const confirm = await this.onWantedToDelete(commentToRedraft, $localize`Delete and re-draft`, $localize`Do you really want to delete and re-draft this comment?`)

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
    if (this.video.commentsEnabled === true) {
      // Reset all our fields
      this.highlightedThread = null
      this.comments = []
      this.threadComments = {}
      this.threadLoading = {}
      this.inReplyToCommentId = undefined
      this.componentPagination.currentPage = 1
      this.componentPagination.totalItems = null

      this.syndicationItems = this.videoCommentService.getVideoCommentsFeeds(this.video.uuid)
      this.loadMoreThreads()
    }
  }

  private processHighlightedThread (highlightedThreadId: number) {
    this.highlightedThread = this.comments.find(c => c.id === highlightedThreadId)

    const highlightThread = true
    this.viewReplies(highlightedThreadId, highlightThread)
  }
}
