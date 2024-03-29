import { pick } from '@peertube/peertube-core-utils'
import {
  HttpStatusCode,
  ResultList,
  VideoComment,
  VideoCommentForAdminOrUser,
  VideoCommentThreads,
  VideoCommentThreadTree
} from '@peertube/peertube-models'
import { unwrapBody } from '../requests/index.js'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

type ListForAdminOrAccountCommonOptions = {
  start?: number
  count?: number
  sort?: string
  search?: string
  searchAccount?: string
  searchVideo?: string
  videoId?: string | number
  videoChannelId?: string | number
  autoTagOneOf?: string[]
}

export class CommentsCommand extends AbstractCommand {

  private lastVideoId: number | string
  private lastThreadId: number
  private lastReplyId: number

  listForAdmin (options: OverrideCommandOptions & ListForAdminOrAccountCommonOptions & {
    isLocal?: boolean
    onLocalVideo?: boolean
  } = {}) {
    const path = '/api/v1/videos/comments'

    const query = {
      ...this.buildListForAdminOrAccountQuery(options),
      ...pick(options, [ 'isLocal', 'onLocalVideo' ])
    }

    return this.getRequestBody<ResultList<VideoCommentForAdminOrUser>>({
      ...options,

      path,
      query,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  listCommentsOnMyVideos (options: OverrideCommandOptions & ListForAdminOrAccountCommonOptions & {
    isHeldForReview?: boolean
  } = {}) {
    const path = '/api/v1/users/me/videos/comments'

    return this.getRequestBody<ResultList<VideoCommentForAdminOrUser>>({
      ...options,

      path,
      query: {
        ...this.buildListForAdminOrAccountQuery(options),

        isHeldForReview: options.isHeldForReview
      },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  private buildListForAdminOrAccountQuery (options: ListForAdminOrAccountCommonOptions) {
    return {
      sort: '-createdAt',

      ...pick(options, [ 'start', 'count', 'search', 'searchAccount', 'searchVideo', 'sort', 'videoId', 'videoChannelId', 'autoTagOneOf' ])
    }
  }

  // ---------------------------------------------------------------------------

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

  async getThreadOf (options: OverrideCommandOptions & {
    videoId: number | string
    text: string
  }) {
    const { videoId, text } = options
    const threadId = await this.findCommentId({ videoId, text })

    return this.getThread({ ...options, videoId, threadId })
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
    const { data } = await this.listForAdmin({ videoId, count: 25, sort: '-createdAt' })

    return data.find(c => c.text === text).id
  }

  // ---------------------------------------------------------------------------

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

  async deleteAllComments (options: OverrideCommandOptions & {
    videoUUID: string
  }) {
    const { data } = await this.listForAdmin({ ...options, start: 0, count: 20 })

    for (const comment of data) {
      if (comment?.video.uuid !== options.videoUUID) continue

      await this.delete({ videoId: options.videoUUID, commentId: comment.id, ...options })
    }
  }

  // ---------------------------------------------------------------------------

  approve (options: OverrideCommandOptions & {
    videoId: number | string
    commentId: number
  }) {
    const { videoId, commentId } = options
    const path = '/api/v1/videos/' + videoId + '/comments/' + commentId + '/approve'

    return this.postBodyRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }
}
