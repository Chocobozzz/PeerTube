import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core'
import { UserRight } from '../../../../../../shared/models/users'
import { VideoCommentThreadTree } from '../../../../../../shared/models/videos/video-comment.model'
import { AuthService } from '../../../core/auth'
import { Video } from '../../../shared/video/video.model'
import { VideoComment } from './video-comment.model'
import { MarkdownService } from '@app/shared/renderer'

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

  @Output() wantedToDelete = new EventEmitter<VideoComment>()
  @Output() wantedToReply = new EventEmitter<VideoComment>()
  @Output() threadCreated = new EventEmitter<VideoCommentThreadTree>()
  @Output() resetReply = new EventEmitter()

  sanitizedCommentHTML = ''
  newParentComments: VideoComment[] = []

  constructor (
    private markdownService: MarkdownService,
    private authService: AuthService
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

  isRemovableByUser () {
    return this.comment.account && this.isUserLoggedIn() &&
      (
        this.user.account.id === this.comment.account.id ||
        this.user.hasRight(UserRight.REMOVE_ANY_VIDEO_COMMENT)
      )
  }

  private async init () {
    this.sanitizedCommentHTML = await this.markdownService.textMarkdownToHTML(this.comment.text, true)

    this.newParentComments = this.parentComments.concat([ this.comment ])
  }
}
