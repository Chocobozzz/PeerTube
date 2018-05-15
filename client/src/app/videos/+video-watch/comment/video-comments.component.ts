import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { ConfirmService } from '@app/core'
import { NotificationsService } from 'angular2-notifications'
import { Subscription } from 'rxjs'
import { VideoCommentThreadTree } from '../../../../../../shared/models/videos/video-comment.model'
import { AuthService } from '../../../core/auth'
import { ComponentPagination } from '../../../shared/rest/component-pagination.model'
import { User } from '../../../shared/users'
import { VideoSortField } from '../../../shared/video/sort-field.type'
import { VideoDetails } from '../../../shared/video/video-details.model'
import { VideoComment } from './video-comment.model'
import { VideoCommentService } from './video-comment.service'

@Component({
  selector: 'my-video-comments',
  templateUrl: './video-comments.component.html',
  styleUrls: ['./video-comments.component.scss']
})
export class VideoCommentsComponent implements OnInit, OnChanges, OnDestroy {
  @Input() video: VideoDetails
  @Input() user: User

  comments: VideoComment[] = []
  highlightedThread: VideoComment
  sort: VideoSortField = '-createdAt'
  componentPagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: null
  }
  inReplyToCommentId: number
  threadComments: { [ id: number ]: VideoCommentThreadTree } = {}
  threadLoading: { [ id: number ]: boolean } = {}

  private sub: Subscription

  constructor (
    private authService: AuthService,
    private notificationsService: NotificationsService,
    private confirmService: ConfirmService,
    private videoCommentService: VideoCommentService,
    private activatedRoute: ActivatedRoute
  ) {}

  ngOnInit () {
    // Find highlighted comment in params
    this.sub = this.activatedRoute.params.subscribe(
      params => {
        if (params['threadId']) {
          const highlightedThreadId = +params['threadId']
          this.processHighlightedThread(highlightedThreadId)
        }
      }
    )
  }

  ngOnChanges (changes: SimpleChanges) {
    if (changes['video']) {
      this.resetVideo()
    }
  }

  ngOnDestroy () {
    if (this.sub) this.sub.unsubscribe()
  }

  viewReplies (commentId: number, highlightThread = false) {
    this.threadLoading[commentId] = true

    this.videoCommentService.getVideoThreadComments(this.video.id, commentId)
      .subscribe(
        res => {
          this.threadComments[commentId] = res
          this.threadLoading[commentId] = false

          if (highlightThread) this.highlightedThread = new VideoComment(res.comment)
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
    this.viewReplies(commentTree.comment.id)
  }

  async onWantedToDelete (commentToDelete: VideoComment) {
    let message = 'Do you really want to delete this comment?'
    if (commentToDelete.totalReplies !== 0) message += `${commentToDelete.totalReplies} would be deleted too.`

    const res = await this.confirmService.confirm(message, 'Delete')
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

  private resetVideo () {
    if (this.video.commentsEnabled === true) {
      // Reset all our fields
      this.highlightedThread = null
      this.comments = []
      this.threadComments = {}
      this.threadLoading = {}
      this.inReplyToCommentId = undefined
      this.componentPagination.currentPage = 1
      this.componentPagination.totalItems = null

      this.loadMoreComments()
    }
  }

  private processHighlightedThread (highlightedThreadId: number) {
    this.highlightedThread = this.comments.find(c => c.id === highlightedThreadId)

    const highlightThread = true
    this.viewReplies(highlightedThreadId, highlightThread)
  }
}
