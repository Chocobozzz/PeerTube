import { NgClass } from '@angular/common'
import { Component, OnChanges, OnInit, inject, input, model, output, viewChild } from '@angular/core'
import { RouterLink } from '@angular/router'
import { MarkdownService, Notifier, UserService } from '@app/core'
import { AuthService } from '@app/core/auth'
import { ActorAvatarComponent } from '@app/shared/shared-actor-image/actor-avatar.component'
import { Account } from '@app/shared/shared-main/account/account.model'
import { DropdownAction } from '@app/shared/shared-main/buttons/action-dropdown.component'
import { FromNowPipe } from '@app/shared/shared-main/date/from-now.pipe'
import { Video } from '@app/shared/shared-main/video/video.model'
import { CommentReportComponent } from '@app/shared/shared-moderation/report-modals/comment-report.component'
import { UserModerationDropdownComponent } from '@app/shared/shared-moderation/user-moderation-dropdown.component'
import { VideoCommentThreadTree } from '@app/shared/shared-video-comment/video-comment-thread-tree.model'
import { VideoComment } from '@app/shared/shared-video-comment/video-comment.model'
import { User, UserRight } from '@peertube/peertube-models'
import { TimestampRouteTransformerDirective } from '../timestamp-route-transformer.directive'
import { VideoCommentAddComponent } from './video-comment-add.component'

@Component({
  selector: 'my-video-comment',
  templateUrl: './video-comment.component.html',
  styleUrls: [ './video-comment.component.scss' ],
  imports: [
    NgClass,
    ActorAvatarComponent,
    RouterLink,
    TimestampRouteTransformerDirective,
    UserModerationDropdownComponent,
    VideoCommentAddComponent,
    CommentReportComponent,
    FromNowPipe
  ]
})
export class VideoCommentComponent implements OnInit, OnChanges {
  private markdownService = inject(MarkdownService)
  private authService = inject(AuthService)
  private userService = inject(UserService)
  private notifier = inject(Notifier)

  readonly commentReportModal = viewChild<CommentReportComponent>('commentReportModal')

  readonly video = input<Video>(undefined)
  readonly videoPassword = input<string>(undefined)
  readonly comment = input<VideoComment>(undefined)
  readonly parentComments = input<VideoComment[]>([])
  readonly inReplyToCommentId = input<number>(undefined)
  readonly highlightedComment = input(false)
  readonly firstInThread = input(false)
  readonly commentTree = model<VideoCommentThreadTree>(undefined)
  readonly redraftValue = model<string>(undefined)

  readonly wantedToReply = output<VideoComment>()
  readonly wantedToDelete = output<VideoComment>()
  readonly wantedToApprove = output<VideoComment>()
  readonly wantedToRedraft = output<VideoComment>()
  readonly threadCreated = output<VideoCommentThreadTree>()
  readonly resetReply = output()
  readonly timestampClicked = output<number>()

  prependModerationActions: DropdownAction<any>[]

  sanitizedCommentHTML = ''
  newParentComments: VideoComment[] = []

  commentAccount: Account
  commentUser: User

  get user () {
    return this.authService.getUser()
  }

  ngOnInit () {
    this.init()
  }

  ngOnChanges () {
    this.init()
  }

  onCommentReplyCreated (createdComment: VideoComment) {
    if (!this.commentTree()) {
      this.commentTree.set({
        comment: this.comment(),
        hasDisplayedChildren: false,
        children: []
      })

      this.threadCreated.emit(this.commentTree())
    }

    this.commentTree().children.unshift({
      comment: createdComment,
      hasDisplayedChildren: false,
      children: []
    })

    this.resetReply.emit()

    this.redraftValue.set(undefined)
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
    return this.parentComments().length !== 0
  }

  private getUserIfNeeded (account: Account) {
    if (!account.userId) return
    if (!this.authService.isLoggedIn()) return

    const user = this.authService.getUser()
    if (user.hasRight(UserRight.MANAGE_USERS)) {
      this.userService.getUserWithCache(account.userId)
        .subscribe({
          next: user => this.commentUser = user,

          error: err => this.notifier.handleError(err)
        })
    }
  }

  private async init () {
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
  }

  private showReportModal () {
    this.commentReportModal().show()
  }
}
