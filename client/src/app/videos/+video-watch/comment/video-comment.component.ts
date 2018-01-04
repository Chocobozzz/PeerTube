import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import * as sanitizeHtml from 'sanitize-html'
import { Account as AccountInterface } from '../../../../../../shared/models/actors'
import { UserRight } from '../../../../../../shared/models/users'
import { VideoCommentThreadTree } from '../../../../../../shared/models/videos/video-comment.model'
import { AuthService } from '../../../core/auth'
import { Account } from '../../../shared/account/account.model'
import { Video } from '../../../shared/video/video.model'
import { VideoComment } from './video-comment.model'

@Component({
  selector: 'my-video-comment',
  templateUrl: './video-comment.component.html',
  styleUrls: ['./video-comment.component.scss']
})
export class VideoCommentComponent implements OnInit {
  @Input() video: Video
  @Input() comment: VideoComment
  @Input() commentTree: VideoCommentThreadTree
  @Input() inReplyToCommentId: number

  @Output() wantedToDelete = new EventEmitter<VideoComment>()
  @Output() wantedToReply = new EventEmitter<VideoComment>()
  @Output() threadCreated = new EventEmitter<VideoCommentThreadTree>()
  @Output() resetReply = new EventEmitter()

  sanitizedCommentHTML = ''

  constructor (private authService: AuthService) {}

  get user () {
    return this.authService.getUser()
  }

  ngOnInit () {
    this.sanitizedCommentHTML = sanitizeHtml(this.comment.text, {
      allowedTags: [ 'p', 'span' ]
    })
  }

  onCommentReplyCreated (createdComment: VideoComment) {
    if (!this.commentTree) {
      this.commentTree = {
        comment: this.comment,
        children: []
      }

      this.threadCreated.emit(this.commentTree)
    }

    this.commentTree.children.push({
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

  getAvatarUrl (account: AccountInterface) {
    return Account.GET_ACCOUNT_AVATAR_URL(account)
  }

  isRemovableByUser () {
    return this.isUserLoggedIn() &&
      (
        this.user.account.id === this.comment.account.id ||
        this.user.hasRight(UserRight.REMOVE_ANY_VIDEO_COMMENT)
      )
  }
}
