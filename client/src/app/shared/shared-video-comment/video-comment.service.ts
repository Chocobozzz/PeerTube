import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { ComponentPaginationLight, RestExtractor, RestPagination, RestService } from '@app/core'
import { objectLineFeedToHtml } from '@app/helpers'
import {
  FeedFormat,
  ResultList,
  ThreadsResultList,
  Video,
  VideoCommentCreate,
  VideoCommentForAdminOrUser,
  VideoComment as VideoCommentServerModel,
  VideoCommentThreadTree as VideoCommentThreadTreeServerModel
} from '@peertube/peertube-models'
import { SortMeta } from 'primeng/api'
import { Observable, from } from 'rxjs'
import { catchError, concatMap, map, toArray } from 'rxjs/operators'
import { environment } from '../../../environments/environment'
import { VideoPasswordService } from '../shared-main/video/video-password.service'
import { VideoCommentThreadTree } from './video-comment-thread-tree.model'
import { VideoComment } from './video-comment.model'

@Injectable()
export class VideoCommentService {
  private authHttp = inject(HttpClient)
  private restExtractor = inject(RestExtractor)
  private restService = inject(RestService)

  static BASE_FEEDS_URL = environment.apiUrl + '/feeds/video-comments.'

  private static BASE_VIDEO_URL = environment.apiUrl + '/api/v1/videos/'
  private static BASE_ME_URL = environment.apiUrl + '/api/v1/users/me/'

  addCommentThread (videoId: string, comment: VideoCommentCreate, videoPassword?: string) {
    const headers = VideoPasswordService.buildVideoPasswordHeader(videoPassword)
    const url = VideoCommentService.BASE_VIDEO_URL + videoId + '/comment-threads'
    const normalizedComment = objectLineFeedToHtml(comment, 'text')

    return this.authHttp.post<{ comment: VideoCommentServerModel }>(url, normalizedComment, { headers })
      .pipe(
        map(data => this.extractVideoComment(data.comment)),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  addCommentReply (options: { videoId: string, inReplyToCommentId: number, comment: VideoCommentCreate, videoPassword?: string }) {
    const { videoId, inReplyToCommentId, comment, videoPassword } = options
    const headers = VideoPasswordService.buildVideoPasswordHeader(videoPassword)
    const url = VideoCommentService.BASE_VIDEO_URL + videoId + '/comments/' + inReplyToCommentId
    const normalizedComment = objectLineFeedToHtml(comment, 'text')

    return this.authHttp.post<{ comment: VideoCommentServerModel }>(url, normalizedComment, { headers })
      .pipe(
        map(data => this.extractVideoComment(data.comment)),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  // ---------------------------------------------------------------------------

  approveComments (comments: {
    videoId: number
    commentId: number
  }[]) {
    return from(comments)
      .pipe(
        concatMap(({ videoId, commentId }) => {
          const url = VideoCommentService.BASE_VIDEO_URL + videoId + '/comments/' + commentId + '/approve'

          return this.authHttp.post(url, {})
            .pipe(catchError(err => this.restExtractor.handleError(err)))
        }),
        toArray()
      )
  }

  // ---------------------------------------------------------------------------

  listVideoCommentsOfMyVideos (
    options: Parameters<VideoCommentService['buildAdminVideoCommentsParams']>[0] & {
      isHeldForReview?: boolean
    }
  ): Observable<ResultList<VideoCommentForAdminOrUser>> {
    const { isHeldForReview } = options

    const url = VideoCommentService.BASE_ME_URL + 'videos/comments'

    let params = this.buildAdminVideoCommentsParams(options)
    params = params.set('includeCollaborations', 'true')

    if (isHeldForReview !== undefined) {
      params = params.set('isHeldForReview', '' + isHeldForReview)
    }

    return this.authHttp.get<ResultList<VideoCommentForAdminOrUser>>(url, { params })
      .pipe(
        catchError(res => this.restExtractor.handleError(res))
      )
  }

  listAdminVideoComments (
    options: Parameters<VideoCommentService['buildAdminVideoCommentsParams']>[0] & {
      isLocal?: boolean
      onLocalVideo?: boolean
    }
  ): Observable<ResultList<VideoCommentForAdminOrUser>> {
    const { isLocal, onLocalVideo } = options

    const url = VideoCommentService.BASE_VIDEO_URL + 'comments'

    let params = this.buildAdminVideoCommentsParams(options)

    if (isLocal !== undefined) {
      params = params.set('isLocal', '' + isLocal)
    }

    if (onLocalVideo !== undefined) {
      params = params.set('onLocalVideo', '' + onLocalVideo)
    }

    return this.authHttp.get<ResultList<VideoCommentForAdminOrUser>>(url, { params })
      .pipe(
        catchError(res => this.restExtractor.handleError(res))
      )
  }

  private buildAdminVideoCommentsParams (options: {
    pagination: RestPagination
    sort: SortMeta
    search?: string
    searchAccount?: string
    searchVideo?: string
    autoTagOneOf?: string[]
  }) {
    const { pagination, sort, ...otherOptions } = options

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)
    params = this.restService.addObjectParams(params, otherOptions)

    return params
  }

  // ---------------------------------------------------------------------------

  getVideoCommentThreads (parameters: {
    videoId: string
    videoPassword: string
    componentPagination: ComponentPaginationLight
    sort: string
  }): Observable<ThreadsResultList<VideoComment>> {
    const { videoId, videoPassword, componentPagination, sort } = parameters

    const headers = VideoPasswordService.buildVideoPasswordHeader(videoPassword)

    const pagination = this.restService.componentToRestPagination(componentPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    const url = VideoCommentService.BASE_VIDEO_URL + videoId + '/comment-threads'
    return this.authHttp.get<ThreadsResultList<VideoComment>>(url, { params, headers })
      .pipe(
        map(result => this.extractVideoComments(result)),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  getVideoThreadComments (parameters: {
    videoId: string
    threadId: number
    videoPassword?: string
  }): Observable<VideoCommentThreadTree> {
    const { videoId, threadId, videoPassword } = parameters
    const url = `${VideoCommentService.BASE_VIDEO_URL + videoId}/comment-threads/${threadId}`
    const headers = VideoPasswordService.buildVideoPasswordHeader(videoPassword)

    return this.authHttp
      .get<VideoCommentThreadTreeServerModel>(url, { headers })
      .pipe(
        map(tree => this.extractVideoCommentTree(tree)),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  // ---------------------------------------------------------------------------

  deleteVideoComment (videoId: number | string, commentId: number) {
    const url = `${VideoCommentService.BASE_VIDEO_URL + videoId}/comments/${commentId}`

    return this.authHttp
      .delete(url)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  deleteVideoComments (comments: { videoId: number | string, commentId: number }[]) {
    return from(comments)
      .pipe(
        concatMap(c => this.deleteVideoComment(c.videoId, c.commentId)),
        toArray()
      )
  }

  // ---------------------------------------------------------------------------

  getVideoCommentsFeeds (video: Pick<Video, 'uuid'>) {
    const feeds = [
      {
        format: FeedFormat.RSS,
        label: 'rss 2.0',
        url: VideoCommentService.BASE_FEEDS_URL + FeedFormat.RSS.toLowerCase()
      },
      {
        format: FeedFormat.ATOM,
        label: 'atom 1.0',
        url: VideoCommentService.BASE_FEEDS_URL + FeedFormat.ATOM.toLowerCase()
      },
      {
        format: FeedFormat.JSON,
        label: 'json 1.0',
        url: VideoCommentService.BASE_FEEDS_URL + FeedFormat.JSON.toLowerCase()
      }
    ]

    if (video !== undefined) {
      for (const feed of feeds) {
        feed.url += '?videoId=' + video.uuid
      }
    }

    return feeds
  }

  private extractVideoComment (videoComment: VideoCommentServerModel) {
    return new VideoComment(videoComment)
  }

  private extractVideoComments (result: ThreadsResultList<VideoCommentServerModel>) {
    const videoCommentsJson = result.data
    const totalComments = result.total
    const comments: VideoComment[] = []

    for (const videoCommentJson of videoCommentsJson) {
      comments.push(new VideoComment(videoCommentJson))
    }

    return { data: comments, total: totalComments, totalNotDeletedComments: result.totalNotDeletedComments }
  }

  private extractVideoCommentTree (serverTree: VideoCommentThreadTreeServerModel): VideoCommentThreadTree {
    if (!serverTree) return null

    const tree = {
      comment: new VideoComment(serverTree.comment),
      children: serverTree.children.map(c => this.extractVideoCommentTree(c))
    }

    const hasDisplayedChildren = tree.children.length === 0
      ? !tree.comment.isDeleted
      : tree.children.some(c => c.hasDisplayedChildren)

    return Object.assign(tree, { hasDisplayedChildren })
  }
}
