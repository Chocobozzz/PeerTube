import { SortMeta } from 'primeng/api'
import { from, Observable } from 'rxjs'
import { catchError, concatMap, map, toArray } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { ComponentPaginationLight, RestExtractor, RestPagination, RestService } from '@app/core'
import { objectLineFeedToHtml } from '@app/helpers'
import {
  FeedFormat,
  ResultList,
  ThreadsResultList,
  Video,
  VideoComment as VideoCommentServerModel,
  VideoCommentAdmin,
  VideoCommentCreate,
  VideoCommentThreadTree as VideoCommentThreadTreeServerModel
} from '@shared/models'
import { environment } from '../../../environments/environment'
import { VideoCommentThreadTree } from './video-comment-thread-tree.model'
import { VideoComment } from './video-comment.model'

@Injectable()
export class VideoCommentService {
  static BASE_FEEDS_URL = environment.apiUrl + '/feeds/video-comments.'

  private static BASE_VIDEO_URL = environment.apiUrl + '/api/v1/videos/'

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService
  ) {}

  addCommentThread (videoId: number | string, comment: VideoCommentCreate) {
    const url = VideoCommentService.BASE_VIDEO_URL + videoId + '/comment-threads'
    const normalizedComment = objectLineFeedToHtml(comment, 'text')

    return this.authHttp.post<{ comment: VideoCommentServerModel }>(url, normalizedComment)
               .pipe(
                  map(data => this.extractVideoComment(data.comment)),
                  catchError(err => this.restExtractor.handleError(err))
               )
  }

  addCommentReply (videoId: number | string, inReplyToCommentId: number, comment: VideoCommentCreate) {
    const url = VideoCommentService.BASE_VIDEO_URL + videoId + '/comments/' + inReplyToCommentId
    const normalizedComment = objectLineFeedToHtml(comment, 'text')

    return this.authHttp.post<{ comment: VideoCommentServerModel }>(url, normalizedComment)
               .pipe(
                 map(data => this.extractVideoComment(data.comment)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  getAdminVideoComments (options: {
    pagination: RestPagination,
    sort: SortMeta,
    search?: string
  }): Observable<ResultList<VideoCommentAdmin>> {
    const { pagination, sort, search } = options
    const url = VideoCommentService.BASE_VIDEO_URL + 'comments'

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    if (search) {
      params = this.buildParamsFromSearch(search, params)
    }

    return this.authHttp.get<ResultList<VideoCommentAdmin>>(url, { params })
      .pipe(
        catchError(res => this.restExtractor.handleError(res))
      )
  }

  getVideoCommentThreads (parameters: {
    videoId: number | string,
    componentPagination: ComponentPaginationLight,
    sort: string
  }): Observable<ThreadsResultList<VideoComment>> {
    const { videoId, componentPagination, sort } = parameters

    const pagination = this.restService.componentPaginationToRestPagination(componentPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    const url = VideoCommentService.BASE_VIDEO_URL + videoId + '/comment-threads'
    return this.authHttp.get<ThreadsResultList<VideoComment>>(url, { params })
               .pipe(
                 map(result => this.extractVideoComments(result)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  getVideoThreadComments (parameters: {
    videoId: number | string,
    threadId: number
  }): Observable<VideoCommentThreadTree> {
    const { videoId, threadId } = parameters
    const url = `${VideoCommentService.BASE_VIDEO_URL + videoId}/comment-threads/${threadId}`

    return this.authHttp
               .get<VideoCommentThreadTreeServerModel>(url)
               .pipe(
                 map(tree => this.extractVideoCommentTree(tree)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  deleteVideoComment (videoId: number | string, commentId: number) {
    const url = `${VideoCommentService.BASE_VIDEO_URL + videoId}/comments/${commentId}`

    return this.authHttp
               .delete(url)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  deleteVideoComments (comments: { videoId: number | string, commentId: number }[]) {
    return from(comments)
      .pipe(
        concatMap(c => this.deleteVideoComment(c.videoId, c.commentId)),
        toArray()
      )
  }

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

  private buildParamsFromSearch (search: string, params: HttpParams) {
    const filters = this.restService.parseQueryStringFilter(search, {
      isLocal: {
        prefix: 'local:',
        isBoolean: true
      },

      searchAccount: { prefix: 'account:' },
      searchVideo: { prefix: 'video:' }
    })

    return this.restService.addObjectParams(params, filters)
  }
}
