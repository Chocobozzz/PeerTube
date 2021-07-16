import { pick } from 'lodash'
import { HttpStatusCode, ResultList, VideoComment, VideoCommentThreads, VideoCommentThreadTree } from '@shared/models'
import { unwrapBody } from '../requests'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

export class CommentsCommand extends AbstractCommand {

  listForAdmin (options: OverrideCommandOptions & {
    start?: number
    count?: number
    sort?: string
    isLocal?: boolean
    search?: string
    searchAccount?: string
    searchVideo?: string
  } = {}) {
    const { sort = '-createdAt' } = options
    const path = '/api/v1/videos/comments'

    const query = { sort, ...pick(options, [ 'start', 'count', 'isLocal', 'search', 'searchAccount', 'searchVideo' ]) }

    return this.getRequestBody<ResultList<VideoComment>>({
      ...options,

      path,
      query,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  listThreads (options: OverrideCommandOptions & {
    videoId: number | string
    start?: number
    count?: number
    sort?: string
  }) {
    const { start, count, sort, videoId } = options
    const path = '/api/v1/videos/' + videoId + '/comment-threads'

    return this.getRequestBody<VideoCommentThreads>({
      ...options,

      path,
      query: { start, count, sort },
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  getThread (options: OverrideCommandOptions & {
    videoId: number | string
    threadId: number
  }) {
    const { videoId, threadId } = options
    const path = '/api/v1/videos/' + videoId + '/comment-threads/' + threadId

    return this.getRequestBody<VideoCommentThreadTree>({
      ...options,

      path,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  async createThread (options: OverrideCommandOptions & {
    videoId: number | string
    text: string
  }) {
    const { videoId, text } = options
    const path = '/api/v1/videos/' + videoId + '/comment-threads'

    const body = await unwrapBody<{ comment: VideoComment }>(this.postBodyRequest({
      ...options,

      path,
      fields: { text },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))

    return body.comment
  }

  async addReply (options: OverrideCommandOptions & {
    videoId: number | string
    toCommentId: number
    text: string
  }) {
    const { videoId, toCommentId, text } = options
    const path = '/api/v1/videos/' + videoId + '/comments/' + toCommentId

    const body = await unwrapBody<{ comment: VideoComment }>(this.postBodyRequest({
      ...options,

      path,
      fields: { text },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))

    return body.comment
  }

  async findCommentId (options: OverrideCommandOptions & {
    videoId: number | string
    text: string
  }) {
    const { videoId, text } = options
    const { data } = await this.listThreads({ videoId, count: 25, sort: '-createdAt' })

    return data.find(c => c.text === text).id
  }

  delete (options: OverrideCommandOptions & {
    videoId: number | string
    commentId: number
  }) {
    const { videoId, commentId } = options
    const path = '/api/v1/videos/' + videoId + '/comments/' + commentId

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }
}
