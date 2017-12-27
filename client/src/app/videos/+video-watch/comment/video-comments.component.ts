import { Component, Input, OnInit } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { VideoCommentThreadTree } from '../../../../../../shared/models/videos/video-comment.model'
import { AuthService } from '../../../core/auth'
import { ComponentPagination } from '../../../shared/rest/component-pagination.model'
import { User } from '../../../shared/users'
import { SortField } from '../../../shared/video/sort-field.type'
import { Video } from '../../../shared/video/video.model'
import { VideoComment } from './video-comment.model'
import { VideoCommentService } from './video-comment.service'

@Component({
  selector: 'my-video-comments',
  templateUrl: './video-comments.component.html',
  styleUrls: ['./video-comments.component.scss']
})
export class VideoCommentsComponent implements OnInit {
  @Input() video: Video
  @Input() user: User

  comments: VideoComment[] = []
  sort: SortField = '-createdAt'
  componentPagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 25,
    totalItems: null
  }
  inReplyToCommentId: number
  threadComments: { [ id: number ]: VideoCommentThreadTree } = {}
  threadLoading: { [ id: number ]: boolean } = {}

  constructor (
    private authService: AuthService,
    private notificationsService: NotificationsService,
    private videoCommentService: VideoCommentService
  ) {}

  ngOnInit () {
    this.videoCommentService.getVideoCommentThreads(this.video.id, this.componentPagination, this.sort)
      .subscribe(
        res => {
          this.comments = res.comments
          this.componentPagination.totalItems = res.totalComments
        },

        err => this.notificationsService.error('Error', err.message)
      )
  }

  viewReplies (comment: VideoComment) {
    this.threadLoading[comment.id] = true

    this.videoCommentService.getVideoThreadComments(this.video.id, comment.id)
      .subscribe(
        res => {
          this.threadComments[comment.id] = res
          this.threadLoading[comment.id] = false
        },

        err => this.notificationsService.error('Error', err.message)
      )
  }

  onCommentThreadCreated (comment: VideoComment) {
    this.comments.unshift(comment)
  }

  onWantedToReply (comment: VideoComment) {
    this.inReplyToCommentId = comment.id
  }

  onResetReply () {
    this.inReplyToCommentId = undefined
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }
}
