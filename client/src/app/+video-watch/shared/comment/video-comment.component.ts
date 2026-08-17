import { NgClass } from '@angular/common'
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  TemplateRef,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  viewChild
} from '@angular/core'
import { RouterLink } from '@angular/router'
import { MarkdownService, Notifier, ScreenService, UserService } from '@app/core'
import { AuthService } from '@app/core/auth'
import { HooksService } from '@app/core/plugins/hooks.service'
import { ActorAvatarComponent } from '@app/shared/shared-actor-image/actor-avatar.component'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { Account } from '@app/shared/shared-main/account/account.model'
import { DropdownAction } from '@app/shared/shared-main/buttons/action-dropdown.component'
import { LoaderComponent } from '@app/shared/shared-main/common/loader.component'
import { FromNowPipe } from '@app/shared/shared-main/date/from-now.pipe'
import { Video } from '@app/shared/shared-main/video/video.model'
import { CommentReportComponent } from '@app/shared/shared-moderation/report-modals/comment-report.component'
import { UserModerationDropdownComponent } from '@app/shared/shared-moderation/user-moderation-dropdown.component'
import { VideoCommentThreadTree } from '@app/shared/shared-video-comment/video-comment-thread-tree.model'
import { VideoComment } from '@app/shared/shared-video-comment/video-comment.model'
import { VideoCommentService } from '@app/shared/shared-video-comment/video-comment.service'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { User, UserRight } from '@peertube/peertube-models'
import { Subscription } from 'rxjs'
import { TimestampRouteTransformerDirective } from '../timestamp-route-transformer.directive'
import { VideoCommentAddComponent } from './video-comment-add.component'

@Component({
  selector: 'my-video-comment',
  templateUrl: './video-comment.component.html',
  styleUrls: [ './video-comment.component.scss' ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgClass,
    ActorAvatarComponent,
    RouterLink,
    TimestampRouteTransformerDirective,
    UserModerationDropdownComponent,
    VideoCommentAddComponent,
    CommentReportComponent,
    GlobalIconComponent,
    FromNowPipe,
    LoaderComponent
  ]
})
export class VideoCommentComponent implements OnChanges, OnDestroy {
  private cd = inject(ChangeDetectorRef)
  private markdownService = inject(MarkdownService)
  private authService = inject(AuthService)
  private userService = inject(UserService)
  private notifier = inject(Notifier)
  private screenService = inject(ScreenService)
  private modalService = inject(NgbModal)
  private videoCommentService = inject(VideoCommentService)
  private hooks = inject(HooksService)

  readonly commentReportModal = viewChild<CommentReportComponent>('commentReportModal')
  readonly commentReplyModal = viewChild<TemplateRef<any>>('commentReplyModal')

  readonly video = input<Video>(undefined)
  readonly videoPassword = input<string>(undefined)
  readonly comment = input<VideoComment>(undefined)
  readonly parentComments = input<VideoComment[]>([])
  readonly inReplyToCommentId = input<number>(undefined)
  readonly highlightedComment = input(false)
  readonly firstInThread = input(false)
  readonly commentTree = model<VideoCommentThreadTree>(undefined)
  readonly redraftValue = model<string>(undefined)

  // Nesting level of this comment, reset to 0 when the thread is continued in a modal
  readonly depth = input(0)
  // Immediately fetch the replies instead of displaying a "View replies" button
  readonly autoLoadReplies = input(false)

  readonly wantedToReply = output<VideoComment>()
  readonly wantedToDelete = output<VideoComment>()
  readonly wantedToApprove = output<VideoComment>()
  readonly wantedToRedraft = output<VideoComment>()
  readonly threadCreated = output<VideoCommentThreadTree>()
  readonly resetReply = output()
  readonly timestampClicked = output<number>()
  // `parentComments` is forwarded so replies written in the modal keep mentioning the whole ancestor chain
  readonly wantedToViewRepliesInModal = output<{ comment: VideoComment, parentComments: VideoComment[] }>()

  prependModerationActions: DropdownAction<any>[]

  sanitizedCommentHTML = ''
  newParentComments: VideoComment[] = []

  commentAccount: Account
  commentUser: User
  private replyModalRef: NgbModalRef

  showCommentReportModal = false
  private reportModalRequested = signal(0)

  loadingReplies = false
  private repliesSub: Subscription

  get user () {
    return this.authService.getUser()
  }

  constructor () {
    // Open the report modal every time it's requested, waiting for it to be loaded first if it's deferred
    effect(() => {
      if (this.reportModalRequested() === 0) return

      this.commentReportModal()?.show()
    })
  }

  ngOnChanges (changes: SimpleChanges) {
    // The "view replies" modal reuses this component for every comment of its navigation stack:
    // a pending request targets the previous comment tree, so discard it
    if (changes['comment'] && !changes['comment'].firstChange) {
      this.cancelRepliesRequest()
    }

    this.reinit()
    this.toggleMobileReplyModalIfNeeded()
    this.autoLoadRepliesIfNeeded()
  }

  ngOnDestroy () {
    this.cancelRepliesRequest()
  }

  onCommentReplyCreated (createdComment: VideoComment) {
    if (!this.commentTree()) {
      this.commentTree.set({
        comment: this.comment(),
        hasDisplayedChildren: false,
        children: [],
        totalChildren: 0,
        fetchedChildren: 0
      })

      this.threadCreated.emit(this.commentTree())
    }

    const tree = this.commentTree()

    // Inserted locally, not fetched from the server: don't touch `fetchedChildren`, used as the pagination offset
    // A later page may contain this comment again, `viewMoreReplies` deduplicates it
    tree.children.unshift({
      comment: createdComment,
      hasDisplayedChildren: false,
      children: [],
      totalChildren: 0,
      fetchedChildren: 0
    })
    tree.totalChildren++

    // Mutated in place above: bump the signal's identity so consumers relying on it are notified
    this.commentTree.set(tree)

    this.resetReply.emit()

    this.redraftValue.set(undefined)

    this.closeReplyModal()
  }

  // ---------------------------------------------------------------------------
  // Replies the server did not include in the thread tree, because it was too deep or too wide
  // ---------------------------------------------------------------------------

  getNotFetchedRepliesCount () {
    const tree = this.commentTree()
    if (!tree) return 0

    return Math.max(tree.totalChildren - tree.children.length, 0)
  }

  // Do not overflow
  mustViewRepliesInModal () {
    return this.depth() >= this.getMaxInlineDepth()
  }

  viewMoreReplies () {
    if (this.loadingReplies) return

    if (this.mustViewRepliesInModal()) {
      this.wantedToViewRepliesInModal.emit({ comment: this.comment(), parentComments: this.parentComments() })
      return
    }

    this.loadingReplies = true

    const tree = this.commentTree()
    const params = {
      videoId: this.video().uuid,
      commentId: this.comment().id,
      videoPassword: this.videoPassword(),
      // Relative to this comment: don't fetch nesting levels deeper than what can still be rendered inline
      maxDepth: this.getMaxInlineDepth() - this.depth(),
      pagination: {
        start: tree.fetchedChildren,
        count: VideoCommentService.REPLIES_PER_PAGE
      }
    }

    const obs = this.hooks.wrapObsFun(
      this.videoCommentService.getMissingReplies.bind(this.videoCommentService),
      params,
      'video-watch',
      'filter:api.video-watch.video-comment-replies.list.params',
      'filter:api.video-watch.video-comment-replies.list.result'
    )

    this.repliesSub = obs.subscribe({
      next: ({ total, data }) => {
        this.repliesSub = undefined
        this.loadingReplies = false

        // Replies created locally are already displayed but are still part of the server pagination
        const displayedIds = new Set(tree.children.map(c => c.comment.id))

        tree.children = tree.children.concat(data.filter(c => !displayedIds.has(c.comment.id)))
        tree.totalChildren = total
        tree.fetchedChildren += data.length

        // Mutated in place above: bump the signal's identity so consumers relying on it are notified
        this.commentTree.set(tree)

        this.cd.markForCheck()
      },

      error: err => {
        this.repliesSub = undefined
        this.loadingReplies = false
        this.cd.markForCheck()

        this.notifier.handleError(err)
      }
    })
  }

  onWantToReply (comment?: VideoComment) {
    this.wantedToReply.emit(comment || this.comment())
  }

  onWantToDelete (comment?: VideoComment) {
    this.wantedToDelete.emit(comment || this.comment())
  }

  onWantToRedraft (comment?: VideoComment) {
    this.wantedToRedraft.emit(comment || this.comment())
  }

  onWantToApprove (comment?: VideoComment) {
    this.wantedToApprove.emit(comment || this.comment())
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  onResetReply () {
    this.resetReply.emit()
    this.closeReplyModal()
  }

  isInMobileView () {
    return this.screenService.isInMobileView()
  }

  handleTimestampClicked (timestamp: number) {
    this.timestampClicked.emit(timestamp)
  }

  canBeRemovedUser () {
    const comment = this.comment()
    return comment.account && this.isUserLoggedIn() &&
      (
        this.user.account.id === comment.account.id ||
        this.user.account.id === this.video().account.id ||
        this.user.hasRight(UserRight.MANAGE_ANY_VIDEO_COMMENT)
      )
  }

  canBeApprovedByUser () {
    return this.comment().account && this.isUserLoggedIn() &&
      (
        this.user.account.id === this.video().account.id ||
        this.user.hasRight(UserRight.MANAGE_ANY_VIDEO_COMMENT)
      )
  }

  isRedraftableByUser () {
    const comment = this.comment()
    return (
      comment.account &&
      this.isUserLoggedIn() &&
      this.user.account.id === comment.account.id &&
      comment.totalReplies === 0
    )
  }

  isReportableByUser () {
    const comment = this.comment()
    return (
      comment.account &&
      this.isUserLoggedIn() &&
      comment.isDeleted === false &&
      this.user.account.id !== comment.account.id
    )
  }

  isCommentDisplayed () {
    // Not deleted
    const comment = this.comment()
    return !comment.isDeleted ||
      comment.totalReplies !== 0 || // Or root comment thread has replies
      (this.commentTree()?.hasDisplayedChildren) // Or this is a reply that have other replies
  }

  isChild () {
    return this.depth() !== 0
  }

  private getMaxInlineDepth () {
    return this.videoCommentService.getMaxInlineCommentDepth()
  }

  private cancelRepliesRequest () {
    if (!this.repliesSub) return

    this.repliesSub.unsubscribe()
    this.repliesSub = undefined
    this.loadingReplies = false
  }

  private autoLoadRepliesIfNeeded () {
    if (!this.autoLoadReplies() || this.loadingReplies) return

    if (this.commentTree()?.children.length !== 0) return
    if (this.getNotFetchedRepliesCount() === 0) return

    this.viewMoreReplies()
  }

  private getUserIfNeeded (account: Account) {
    if (!account.userId) return
    if (!this.authService.isLoggedIn()) return

    const user = this.authService.getUser()
    if (user.hasRight(UserRight.MANAGE_USERS)) {
      this.userService.getUserWithCache(account.userId)
        .subscribe({
          next: user => {
            this.commentUser = user
            this.cd.markForCheck()
          },

          error: err => this.notifier.handleError(err)
        })
    }
  }

  private async reinit () {
    // Before HTML rendering restore line feed for markdown list compatibility
    const commentText = this.comment().text.replace(/<br.?\/?>/g, '\r\n')
    const html = await this.markdownService.textMarkdownToHTML({ markdown: commentText, withHtml: true, withEmoji: true })
    this.sanitizedCommentHTML = this.markdownService.processVideoTimestamps(this.video().shortUUID, html)
    this.newParentComments = this.parentComments().concat([ this.comment() ])

    const comment = this.comment()
    if (comment.account) {
      this.commentAccount = new Account(comment.account)
      this.getUserIfNeeded(this.commentAccount)
    } else {
      comment.account = null
    }

    this.prependModerationActions = []

    if (this.canBeApprovedByUser() && comment.heldForReview) {
      this.prependModerationActions.push({
        label: $localize`Approve`,
        iconName: 'tick',
        handler: () => this.onWantToApprove()
      })
    }

    if (this.isReportableByUser()) {
      this.prependModerationActions.push({
        label: $localize`Report this comment`,
        iconName: 'flag',
        handler: () => this.showReportModal()
      })
    }

    if (this.canBeRemovedUser()) {
      this.prependModerationActions.push({
        label: $localize`Remove`,
        iconName: 'delete',
        handler: () => this.onWantToDelete()
      })
    }

    if (this.isRedraftableByUser()) {
      this.prependModerationActions.push({
        label: $localize`Remove & re-draft`,
        iconName: 'edit',
        handler: () => this.onWantToRedraft()
      })
    }

    if (this.prependModerationActions.length !== 0) {
      this.prependModerationActions.unshift({
        label: $localize`Actions on comment`,
        isHeader: true
      })
    }

    this.cd.markForCheck()
  }

  private showReportModal () {
    this.showCommentReportModal = true
    this.reportModalRequested.update(v => v + 1)

    this.cd.markForCheck()
  }

  private closeReplyModal () {
    if (!this.replyModalRef) return

    this.replyModalRef.close()
    this.replyModalRef = undefined
  }

  private toggleMobileReplyModalIfNeeded () {
    const shouldOpenReplyModal = this.isInMobileView() &&
      this.inReplyToCommentId() === this.comment().id

    if (!shouldOpenReplyModal || this.replyModalRef) return

    this.replyModalRef = this.modalService.open(this.commentReplyModal(), { centered: true })

    this.replyModalRef.result.finally(() => {
      this.replyModalRef = undefined

      if (this.inReplyToCommentId() === this.comment().id) {
        this.resetReply.emit()
      }
    })
  }
}
