import { Component, EventEmitter, Input, Output } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { VideoCommentThreadTree } from '../../../../../../shared/models/videos/video-comment.model'
import { AuthService } from '../../../core/auth'
import { User } from '../../../shared/users'
import { Video } from '../../../shared/video/video.model'
import { VideoComment } from './video-comment.model'
import { VideoCommentService } from './video-comment.service'

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

  constructor (private authService: AuthService,
               private notificationsService: NotificationsService,
               private videoCommentService: VideoCommentService) {
  }

  onCommentReplyCreated (comment: VideoComment) {
    this.videoCommentService.addCommentReply(this.video.id, this.comment.id, comment)
      .subscribe(
        createdComment => {
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
        },

        err => this.notificationsService.error('Error', err.message)
      )
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
}
