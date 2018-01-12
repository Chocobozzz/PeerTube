import { Component, Input, OnChanges, SimpleChanges } from '@angular/core'
import { ConfirmService } from '@app/core'
import { NotificationsService } from 'angular2-notifications'
import { VideoComment as VideoCommentInterface, VideoCommentThreadTree } from '../../../../../../shared/models/videos/video-comment.model'
import { AuthService } from '../../../core/auth'
import { ComponentPagination } from '../../../shared/rest/component-pagination.model'
import { User } from '../../../shared/users'
import { SortField } from '../../../shared/video/sort-field.type'
import { VideoDetails } from '../../../shared/video/video-details.model'
import { VideoComment } from './video-comment.model'
import { VideoCommentService } from './video-comment.service'

@Component({
  selector: 'my-video-comments',
  templateUrl: './video-comments.component.html',
  styleUrls: ['./video-comments.component.scss']
})
export class VideoCommentsComponent implements OnChanges {
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
    private confirmService: ConfirmService,
    private videoCommentService: VideoCommentService
  ) {}

  ngOnChanges (changes: SimpleChanges) {
    if (changes['video']) {
      this.loadVideoComments()
    }
  }

  viewReplies (comment: VideoCommentInterface) {
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

  onThreadCreated (commentTree: VideoCommentThreadTree) {
    this.viewReplies(commentTree.comment)
  }

  onWantedToDelete (commentToDelete: VideoComment) {
    let message = 'Do you really want to delete this comment?'
    if (commentToDelete.totalReplies !== 0) message += `${commentToDelete.totalReplies} would be deleted too.`

    this.confirmService.confirm(message, 'Delete').subscribe(
      res => {
        if (res === false) return

        this.videoCommentService.deleteVideoComment(commentToDelete.videoId, commentToDelete.id)
          .subscribe(
            () => {
              // Delete the comment in the tree
              if (commentToDelete.inReplyToCommentId) {
                const thread = this.threadComments[commentToDelete.threadId]
                if (!thread) {
                  console.error(`Cannot find thread ${commentToDelete.threadId} of the comment to delete ${commentToDelete.id}`)
                  return
                }

                this.deleteLocalCommentThread(thread, commentToDelete)
                return
              }

              // Delete the thread
              this.comments = this.comments.filter(c => c.id !== commentToDelete.id)
              this.componentPagination.totalItems--
            },

            err => this.notificationsService.error('Error', err.message)
          )
      }
    )
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

  private hasMoreComments () {
    // No results
    if (this.componentPagination.totalItems === 0) return false

    // Not loaded yet
    if (!this.componentPagination.totalItems) return true

    const maxPage = this.componentPagination.totalItems / this.componentPagination.itemsPerPage
    return maxPage > this.componentPagination.currentPage
  }

  private deleteLocalCommentThread (parentComment: VideoCommentThreadTree, commentToDelete: VideoComment) {
    for (const commentChild of parentComment.children) {
      if (commentChild.comment.id === commentToDelete.id) {
        parentComment.children = parentComment.children.filter(c => c.comment.id !== commentToDelete.id)
        return
      }

      this.deleteLocalCommentThread(commentChild, commentToDelete)
    }
  }

  private loadVideoComments () {
    if (this.video.commentsEnabled === true) {
      // Reset all our fields
      this.comments = []
      this.threadComments = {}
      this.threadLoading = {}
      this.inReplyToCommentId = undefined
      this.componentPagination = {
        currentPage: 1,
        itemsPerPage: 10,
        totalItems: null
      }

      this.loadMoreComments()
    }
  }
}
