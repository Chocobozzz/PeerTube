import { catchError, map } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { lineFeedToHtml } from '@app/shared/misc/utils'
import { Observable } from 'rxjs'
import { ResultList, FeedFormat } from '../../../../../../shared/models'
import {
  VideoComment as VideoCommentServerModel,
  VideoCommentCreate,
  VideoCommentThreadTree
} from '../../../../../../shared/models/videos/video-comment.model'
import { environment } from '../../../../environments/environment'
import { RestExtractor, RestService } from '../../../shared/rest'
import { ComponentPagination } from '../../../shared/rest/component-pagination.model'
import { VideoSortField } from '../../../shared/video/sort-field.type'
import { VideoComment } from './video-comment.model'

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
    const normalizedComment = lineFeedToHtml(comment, 'text')

    return this.authHttp.post(url, normalizedComment)
               .pipe(
                  map(data => this.extractVideoComment(data['comment'])),
                  catchError(err => this.restExtractor.handleError(err))
               )
  }

  addCommentReply (videoId: number | string, inReplyToCommentId: number, comment: VideoCommentCreate) {
    const url = VideoCommentService.BASE_VIDEO_URL + videoId + '/comments/' + inReplyToCommentId
    const normalizedComment = lineFeedToHtml(comment, 'text')

    return this.authHttp.post(url, normalizedComment)
               .pipe(
                 map(data => this.extractVideoComment(data[ 'comment' ])),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  getVideoCommentThreads (
    videoId: number | string,
    componentPagination: ComponentPagination,
    sort: VideoSortField
  ): Observable<{ comments: VideoComment[], totalComments: number}> {
    const pagination = this.restService.componentPaginationToRestPagination(componentPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    const url = VideoCommentService.BASE_VIDEO_URL + videoId + '/comment-threads'
    return this.authHttp
               .get(url, { params })
               .pipe(
                 map(this.extractVideoComments),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  getVideoThreadComments (videoId: number | string, threadId: number): Observable<VideoCommentThreadTree> {
    const url = `${VideoCommentService.BASE_VIDEO_URL + videoId}/comment-threads/${threadId}`

    return this.authHttp
               .get(url)
               .pipe(
                 map(tree => this.extractVideoCommentTree(tree as VideoCommentThreadTree)),
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

    return { comments, totalComments }
  }

  private extractVideoCommentTree (tree: VideoCommentThreadTree) {
    if (!tree) return tree

    tree.comment = new VideoComment(tree.comment)
    tree.children.forEach(c => this.extractVideoCommentTree(c))

    return tree
  }
}
