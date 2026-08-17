import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  OnChanges,
  OnDestroy,
  OnInit,
  output,
  SimpleChanges,
  TemplateRef,
  viewChild
} from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AuthService, ComponentPagination, ConfirmService, hasMoreItems, Notifier, PluginService, User } from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { InfiniteScrollerDirective } from '@app/shared/shared-main/common/infinite-scroller.directive'
import { LoaderComponent } from '@app/shared/shared-main/common/loader.component'
import { FeedComponent } from '@app/shared/shared-main/feeds/feed.component'
import { Syndication } from '@app/shared/shared-main/feeds/syndication.model'
import { VideoDetails } from '@app/shared/shared-main/video/video-details.model'
import { VideoCommentThreadTree } from '@app/shared/shared-video-comment/video-comment-thread-tree.model'
import { VideoComment } from '@app/shared/shared-video-comment/video-comment.model'
import { VideoCommentService } from '@app/shared/shared-video-comment/video-comment.service'
import {
  NgbDropdown,
  NgbDropdownButtonItem,
  NgbDropdownItem,
  NgbDropdownMenu,
  NgbDropdownToggle,
  NgbModal,
  NgbModalRef
} from '@ng-bootstrap/ng-bootstrap'
import { PeerTubeProblemDocument, ServerErrorCode, VideoCommentPolicy } from '@peertube/peertube-models'
import { lastValueFrom, Subject, Subscription } from 'rxjs'
import { NumberFormatterPipe } from '../../../shared/shared-main/common/number-formatter.pipe'
import { VideoCommentAddComponent } from './video-comment-add.component'
import { VideoCommentComponent } from './video-comment.component'

@Component({
  selector: 'my-video-comments',
  templateUrl: './video-comments.component.html',
  styleUrls: [ './video-comments.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    FeedComponent,
    NgbDropdown,
    NgbDropdownToggle,
    NgbDropdownMenu,
    NgbDropdownButtonItem,
    NgbDropdownItem,
    VideoCommentAddComponent,
    InfiniteScrollerDirective,
    VideoCommentComponent,
    LoaderComponent,
    NumberFormatterPipe,
    GlobalIconComponent
  ]
})
export class VideoCommentsComponent implements OnInit, OnChanges, OnDestroy {
  private authService = inject(AuthService)
  private notifier = inject(Notifier)
  private confirmService = inject(ConfirmService)
  private videoCommentService = inject(VideoCommentService)
  private activatedRoute = inject(ActivatedRoute)
  private hooks = inject(HooksService)
  private pluginService = inject(PluginService)
  private modalService = inject(NgbModal)

  readonly commentHighlightBlock = viewChild<ElementRef>('commentHighlightBlock')
  readonly repliesModal = viewChild<TemplateRef<any>>('repliesModal')

  readonly video = input<VideoDetails>(undefined)
  readonly videoPassword = input<string>(undefined)
  readonly user = input<User>(undefined)

  readonly timestampClicked = output<number>()

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

  threadComments: { [id: number]: VideoCommentThreadTree } = {}
  threadLoading: { [id: number]: boolean } = {}

  // Comments too deeply nested to be displayed inline continue in a modal, where they become a root comment again.
  // We keep the visited comments so the user can navigate back to where they come from
  repliesModalStack: { comment: VideoComment, parentComments: VideoComment[] }[] = []
  repliesModalTree: VideoCommentThreadTree

  syndicationItems: Syndication[] = []

  onDataSubject = new Subject<any[]>()

  private sub: Subscription
  private repliesModalRef: NgbModalRef

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
    if (this.repliesModalRef) this.repliesModalRef.close()
  }

  viewReplies (commentId: number, highlightThread = false) {
    this.threadLoading[commentId] = true

    const params = {
      videoId: this.video().uuid,
      threadId: commentId,
      maxDepth: this.videoCommentService.getMaxInlineCommentDepth(),
      videoPassword: this.videoPassword()
    }

    const obs = this.hooks.wrapObsFun(
      this.videoCommentService.getThread.bind(this.videoCommentService),
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
          setTimeout(() => this.commentHighlightBlock().nativeElement.scrollIntoView(), 0)
        }
      },

      error: err => {
        // We may try to fetch highlighted thread of another video, skip the error if it is the case
        // We'll retry the request on video Input() change
        const errorBody = err.body as PeerTubeProblemDocument
        if (highlightThread && errorBody?.code === ServerErrorCode.COMMENT_NOT_ASSOCIATED_TO_VIDEO) return

        this.notifier.handleError(err)
      }
    })
  }

  async loadMoreThreads (reset = false) {
    if (reset === true) {
      this.componentPagination.currentPage = 1
    }

    const params = {
      videoId: this.video().uuid,
      videoPassword: this.videoPassword(),
      componentPagination: this.componentPagination,
      sort: this.sort
    }

    const obs = this.hooks.wrapObsFun(
      this.videoCommentService.listThreads.bind(this.videoCommentService),
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
    } catch (err: unknown) {
      this.notifier.error((err as Error).message)
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

  // ---------------------------------------------------------------------------
  // Replies that are too deeply nested to be displayed inline
  // ---------------------------------------------------------------------------

  onWantedToViewRepliesInModal (root: {
    comment: VideoComment
    parentComments: VideoComment[]
  }): void {
    this.repliesModalStack.push(root)
    this.setRepliesModalRoot(root.comment)

    if (this.repliesModalRef) return

    this.repliesModalRef = this.modalService.open(this.repliesModal(), { centered: true, size: 'lg' })

    // The result promise rejects when the modal is dismissed (ESC/backdrop click): nothing to do
    this.repliesModalRef.result
      .catch((): undefined => undefined)
      .finally(() => {
        this.repliesModalRef = undefined
        this.repliesModalStack = []
        this.repliesModalTree = undefined
      })
  }

  onRepliesModalBack () {
    this.repliesModalStack.pop()

    const previousRoot = this.getRepliesModalRoot()
    if (!previousRoot) return this.closeRepliesModal()

    this.setRepliesModalRoot(previousRoot.comment)
  }

  closeRepliesModal () {
    if (!this.repliesModalRef) return

    this.repliesModalRef.close()
  }

  getRepliesModalRoot () {
    return this.repliesModalStack[this.repliesModalStack.length - 1]
  }

  // The comment becomes a root comment again: my-video-comment fetches its replies itself
  private setRepliesModalRoot (comment: VideoComment) {
    this.repliesModalTree = {
      comment,
      children: [],
      totalChildren: comment.totalReplies,
      fetchedChildren: 0,
      hasDisplayedChildren: true
    }
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
    if (commentToDelete.isLocal || this.video().isLocal) {
      message += $localize` The deletion will be sent to remote platforms so they can reflect the change.`
    } else {
      message += $localize` It is a remote comment, so the deletion will only be effective on your platform.`
    }

    const res = await this.confirmService.confirm(message, title)
    if (res === false) return false

    this.videoCommentService.deleteComments([ { videoId: commentToDelete.videoId, commentId: commentToDelete.id } ])
      .subscribe({
        next: () => {
          if (this.highlightedThread?.id === commentToDelete.id) {
            commentToDelete = this.comments.find(c => c.id === commentToDelete.id)

            this.highlightedThread = undefined
          }

          // Mark the comment as deleted
          this.softDeleteComment(commentToDelete)
        },

        error: err => this.notifier.handleError(err)
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

        error: err => this.notifier.handleError(err)
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
    const video = this.video()
    if (video.commentsPolicy.id === VideoCommentPolicy.DISABLED) return

    this.closeRepliesModal()

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

    this.syndicationItems = this.videoCommentService.getVideoCommentsFeeds(video)
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
