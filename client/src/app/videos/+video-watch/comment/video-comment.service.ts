import { catchError, map } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { objectLineFeedToHtml } from '@app/shared/misc/utils'
import { Observable } from 'rxjs'
import { FeedFormat, ResultList } from '../../../../../../shared/models'
import {
  VideoComment as VideoCommentServerModel,
  VideoCommentCreate,
  VideoCommentThreadTree as VideoCommentThreadTreeServerModel
} from '../../../../../../shared/models/videos/video-comment.model'
import { environment } from '../../../../environments/environment'
import { RestExtractor, RestService } from '../../../shared/rest'
import { ComponentPaginationLight } from '../../../shared/rest/component-pagination.model'
import { CommentSortField } from '../../../shared/video/sort-field.type'
import { VideoComment } from './video-comment.model'
import { VideoCommentThreadTree } from '@app/videos/+video-watch/comment/video-comment-thread-tree.model'

@Injectable()
export class VideoCommentService {
  private static BASE_VIDEO_URL = environment.apiUrl + '/api/v1/videos/'
  private static BASE_FEEDS_URL = environment.apiUrl + '/feeds/video-comments.'

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

  getVideoCommentThreads (parameters: {
    videoId: number | string,
    componentPagination: ComponentPaginationLight,
    sort: CommentSortField
  }): Observable<ResultList<VideoComment>> {
    const { videoId, componentPagination, sort } = parameters

    const pagination = this.restService.componentPaginationToRestPagination(componentPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    const url = VideoCommentService.BASE_VIDEO_URL + videoId + '/comment-threads'
    return this.authHttp.get<ResultList<VideoComment>>(url, { params })
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

  getVideoCommentsFeeds (videoUUID?: string) {
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

    if (videoUUID !== undefined) {
      for (const feed of feeds) {
        feed.url += '?videoId=' + videoUUID
      }
    }

    return feeds
  }

  private extractVideoComment (videoComment: VideoCommentServerModel) {
    return new VideoComment(videoComment)
  }

  private extractVideoComments (result: ResultList<VideoCommentServerModel>) {
    const videoCommentsJson = result.data
    const totalComments = result.total
    const comments: VideoComment[] = []

    for (const videoCommentJson of videoCommentsJson) {
      comments.push(new VideoComment(videoCommentJson))
    }

    return { data: comments, total: totalComments }
  }

  private extractVideoCommentTree (tree: VideoCommentThreadTreeServerModel) {
    if (!tree) return tree as VideoCommentThreadTree

    tree.comment = new VideoComment(tree.comment)
    tree.children.forEach(c => this.extractVideoCommentTree(c))

    return tree as VideoCommentThreadTree
  }
}
