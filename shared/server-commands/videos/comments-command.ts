import { pick } from '@shared/core-utils'
import { HttpStatusCode, ResultList, VideoComment, VideoCommentThreads, VideoCommentThreadTree } from '@shared/models'
import { unwrapBody } from '../requests'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

export class CommentsCommand extends AbstractCommand {

  private lastVideoId: number | string
  private lastThreadId: number
  private lastReplyId: number

  listForAdmin (options: OverrideCommandOptions & {
    start?: number
    count?: number
    sort?: string
    isLocal?: boolean
    onLocalVideo?: boolean
    search?: string
    searchAccount?: string
    searchVideo?: string
  } = {}) {
    const { sort = '-createdAt' } = options
    const path = '/api/v1/videos/comments'

    const query = { sort, ...pick(options, [ 'start', 'count', 'isLocal', 'onLocalVideo', 'search', 'searchAccount', 'searchVideo' ]) }

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
    videoPassword?: string
    start?: number
    count?: number
    sort?: string
  }) {
    const { start, count, sort, videoId, videoPassword } = options
    const path = '/api/v1/videos/' + videoId + '/comment-threads'

    return this.getRequestBody<VideoCommentThreads>({
      ...options,

      path,
      query: { start, count, sort },
      headers: this.buildVideoPasswordHeader(videoPassword),
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
    videoPassword?: string
  }) {
    const { videoId, text, videoPassword } = options
    const path = '/api/v1/videos/' + videoId + '/comment-threads'

    const body = await unwrapBody<{ comment: VideoComment }>(this.postBodyRequest({
      ...options,

      path,
      fields: { text },
      headers: this.buildVideoPasswordHeader(videoPassword),
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))

    this.lastThreadId = body.comment?.id
    this.lastVideoId = videoId

    return body.comment
  }

  async addReply (options: OverrideCommandOptions & {
    videoId: number | string
    toCommentId: number
    text: string
    videoPassword?: string
  }) {
    const { videoId, toCommentId, text, videoPassword } = options
    const path = '/api/v1/videos/' + videoId + '/comments/' + toCommentId

    const body = await unwrapBody<{ comment: VideoComment }>(this.postBodyRequest({
      ...options,

      path,
      fields: { text },
      headers: this.buildVideoPasswordHeader(videoPassword),
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))

    this.lastReplyId = body.comment?.id

    return body.comment
  }

  async addReplyToLastReply (options: OverrideCommandOptions & {
    text: string
  }) {
    return this.addReply({ ...options, videoId: this.lastVideoId, toCommentId: this.lastReplyId })
  }

  async addReplyToLastThread (options: OverrideCommandOptions & {
    text: string
  }) {
    return this.addReply({ ...options, videoId: this.lastVideoId, toCommentId: this.lastThreadId })
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
