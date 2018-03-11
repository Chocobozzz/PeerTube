import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { lineFeedToHtml } from '@app/shared/misc/utils'
import { MarkdownService } from '@app/videos/shared'
import 'rxjs/add/operator/catch'
import 'rxjs/add/operator/map'
import { Observable } from 'rxjs/Observable'
import { ResultList } from '../../../../../../shared/models'
import {
  VideoComment as VideoCommentServerModel,
  VideoCommentCreate,
  VideoCommentThreadTree
} from '../../../../../../shared/models/videos/video-comment.model'
import { environment } from '../../../../environments/environment'
import { RestExtractor, RestService } from '../../../shared/rest'
import { ComponentPagination } from '../../../shared/rest/component-pagination.model'
import { SortField } from '../../../shared/video/sort-field.type'
import { VideoComment } from './video-comment.model'

@Injectable()
export class VideoCommentService {
  private static BASE_VIDEO_URL = environment.apiUrl + '/api/v1/videos/'

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService
  ) {}

  addCommentThread (videoId: number | string, comment: VideoCommentCreate) {
    const url = VideoCommentService.BASE_VIDEO_URL + videoId + '/comment-threads'
    const normalizedComment = lineFeedToHtml(comment, 'text')

    return this.authHttp.post(url, normalizedComment)
      .map(data => this.extractVideoComment(data['comment']))
      .catch(this.restExtractor.handleError)
  }

  addCommentReply (videoId: number | string, inReplyToCommentId: number, comment: VideoCommentCreate) {
    const url = VideoCommentService.BASE_VIDEO_URL + videoId + '/comments/' + inReplyToCommentId
    const normalizedComment = lineFeedToHtml(comment, 'text')

    return this.authHttp.post(url, normalizedComment)
      .map(data => this.extractVideoComment(data['comment']))
      .catch(this.restExtractor.handleError)
  }

  getVideoCommentThreads (
    videoId: number | string,
    componentPagination: ComponentPagination,
    sort: SortField
  ): Observable<{ comments: VideoComment[], totalComments: number}> {
    const pagination = this.restService.componentPaginationToRestPagination(componentPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    const url = VideoCommentService.BASE_VIDEO_URL + videoId + '/comment-threads'
    return this.authHttp
      .get(url, { params })
      .map(this.extractVideoComments)
      .catch((res) => this.restExtractor.handleError(res))
  }

  getVideoThreadComments (videoId: number | string, threadId: number): Observable<VideoCommentThreadTree> {
    const url = `${VideoCommentService.BASE_VIDEO_URL + videoId}/comment-threads/${threadId}`

    return this.authHttp
      .get(url)
      .map(tree => this.extractVideoCommentTree(tree as VideoCommentThreadTree))
      .catch((res) => this.restExtractor.handleError(res))
  }

  deleteVideoComment (videoId: number | string, commentId: number) {
    const url = `${VideoCommentService.BASE_VIDEO_URL + videoId}/comments/${commentId}`

    return this.authHttp
      .delete(url)
      .map(this.restExtractor.extractDataBool)
      .catch((res) => this.restExtractor.handleError(res))
  }

  private extractVideoComment (videoComment: VideoCommentServerModel) {
    return new VideoComment(videoComment)
  }

  private extractVideoComments (result: ResultList<VideoCommentServerModel>) {
    const videoCommentsJson = result.data
    const totalComments = result.total
    const comments = []

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
