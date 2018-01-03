import { Component, Input, OnInit } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { VideoCommentThreadTree } from '../../../../../../shared/models/videos/video-comment.model'
import { AuthService } from '../../../core/auth'
import { ComponentPagination } from '../../../shared/rest/component-pagination.model'
import { User } from '../../../shared/users'
import { SortField } from '../../../shared/video/sort-field.type'
import { VideoDetails } from '../../../shared/video/video-details.model'
import { Video } from '../../../shared/video/video.model'
import { VideoComment } from './video-comment.model'
import { VideoCommentService } from './video-comment.service'

@Component({
  selector: 'my-video-comments',
  templateUrl: './video-comments.component.html',
  styleUrls: ['./video-comments.component.scss']
})
export class VideoCommentsComponent implements OnInit {
  @Input() video: VideoDetails
  @Input() user: User

  comments: VideoComment[] = []
  sort: SortField = '-createdAt'
  componentPagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 10,
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
    if (this.video.commentsEnabled === true) {
      this.loadMoreComments()
    }
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

  loadMoreComments () {
    this.videoCommentService.getVideoCommentThreads(this.video.id, this.componentPagination, this.sort)
      .subscribe(
        res => {
          this.comments = this.comments.concat(res.comments)
          this.componentPagination.totalItems = res.totalComments
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

  onNearOfBottom () {
    this.componentPagination.currentPage++

    if (this.hasMoreComments()) {
      this.loadMoreComments()
    }
  }

  protected hasMoreComments () {
    // No results
    if (this.componentPagination.totalItems === 0) return false

    // Not loaded yet
    if (!this.componentPagination.totalItems) return true

    const maxPage = this.componentPagination.totalItems / this.componentPagination.itemsPerPage
    return maxPage > this.componentPagination.currentPage
  }
}
