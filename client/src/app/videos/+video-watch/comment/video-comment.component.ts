import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core'
import { User, UserRight } from '../../../../../../shared/models/users'
import { AuthService } from '@app/core/auth'
import { AccountService } from '@app/shared/account/account.service'
import { Video } from '@app/shared/video/video.model'
import { VideoComment } from './video-comment.model'
import { MarkdownService } from '@app/shared/renderer'
import { Account } from '@app/shared/account/account.model'
import { Notifier } from '@app/core'
import { UserService } from '@app/shared'
import { Actor } from '@app/shared/actor/actor.model'
import { VideoCommentThreadTree } from '@app/videos/+video-watch/comment/video-comment-thread-tree.model'

@Component({
  selector: 'my-video-comment',
  templateUrl: './video-comment.component.html',
  styleUrls: ['./video-comment.component.scss']
})
export class VideoCommentComponent implements OnInit, OnChanges {
  @Input() video: Video
  @Input() comment: VideoComment
  @Input() parentComments: VideoComment[] = []
  @Input() commentTree: VideoCommentThreadTree
  @Input() inReplyToCommentId: number
  @Input() highlightedComment = false
  @Input() firstInThread = false

  @Output() wantedToDelete = new EventEmitter<VideoComment>()
  @Output() wantedToReply = new EventEmitter<VideoComment>()
  @Output() threadCreated = new EventEmitter<VideoCommentThreadTree>()
  @Output() resetReply = new EventEmitter()
  @Output() timestampClicked = new EventEmitter<number>()

  sanitizedCommentHTML = ''
  newParentComments: VideoComment[] = []

  commentAccount: Account
  commentUser: User

  constructor (
    private markdownService: MarkdownService,
    private authService: AuthService,
    private accountService: AccountService,
    private userService: UserService,
    private notifier: Notifier
  ) {}

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
    if (!this.commentTree) {
      this.commentTree = {
        comment: this.comment,
        children: []
      }

      this.threadCreated.emit(this.commentTree)
    }

    this.commentTree.children.unshift({
      comment: createdComment,
      children: []
    })
    this.resetReply.emit()
  }

  onWantToReply (comment?: VideoComment) {
    this.wantedToReply.emit(comment || this.comment)
  }

  onWantToDelete (comment?: VideoComment) {
    this.wantedToDelete.emit(comment || this.comment)
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

  isRemovableByUser () {
    return this.comment.account && this.isUserLoggedIn() &&
      (
        this.user.account.id === this.comment.account.id ||
        this.user.hasRight(UserRight.REMOVE_ANY_VIDEO_COMMENT)
      )
  }

  switchToDefaultAvatar ($event: Event) {
    ($event.target as HTMLImageElement).src = Actor.GET_DEFAULT_AVATAR_URL()
  }

  private getUserIfNeeded (account: Account) {
    if (!account.userId) return
    if (!this.authService.isLoggedIn()) return

    const user = this.authService.getUser()
    if (user.hasRight(UserRight.MANAGE_USERS)) {
      this.userService.getUserWithCache(account.userId)
          .subscribe(
            user => this.commentUser = user,

            err => this.notifier.error(err.message)
          )
    }
  }

  private async init () {
    const html = await this.markdownService.textMarkdownToHTML(this.comment.text, true)
    this.sanitizedCommentHTML = await this.markdownService.processVideoTimestamps(html)
    this.newParentComments = this.parentComments.concat([ this.comment ])
    this.commentAccount = new Account(this.comment.account)
    this.getUserIfNeeded(this.commentAccount)
  }
}
