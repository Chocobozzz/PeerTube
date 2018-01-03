import { Component, EventEmitter, Input, Output } from '@angular/core'
import { Account as AccountInterface } from '../../../../../../shared/models/actors'
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
export class VideoCommentComponent {
  @Input() video: Video
  @Input() comment: VideoComment
  @Input() commentTree: VideoCommentThreadTree
  @Input() inReplyToCommentId: number

  @Output() wantedToReply = new EventEmitter<VideoComment>()
  @Output() resetReply = new EventEmitter()

  constructor (private authService: AuthService) {}

  get user () {
    return this.authService.getUser()
  }

  onCommentReplyCreated (createdComment: VideoComment) {
    if (!this.commentTree) {
      this.commentTree = {
        comment: this.comment,
        children: []
      }
    }

    this.commentTree.children.push({
      comment: createdComment,
      children: []
    })
    this.resetReply.emit()
  }

  onWantToReply () {
    this.wantedToReply.emit(this.comment)
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  // Event from child comment
  onWantedToReply (comment: VideoComment) {
    this.wantedToReply.emit(comment)
  }

  onResetReply () {
    this.resetReply.emit()
  }

  getAvatarUrl (account: AccountInterface) {
    return Account.GET_ACCOUNT_AVATAR_URL(account)
  }
}
