import { pick } from '@peertube/peertube-core-utils'
import {
  AbuseFilter,
  AbuseMessage,
  AbusePredefinedReasonsString,
  AbuseStateType,
  AbuseUpdate,
  AbuseVideoIs,
  AdminAbuse,
  HttpStatusCode,
  ResultList,
  UserAbuse
} from '@peertube/peertube-models'
import { unwrapBody } from '../requests/requests.js'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class AbusesCommand extends AbstractCommand {

  report (options: OverrideCommandOptions & {
    reason: string

    accountId?: number
    videoId?: number
    commentId?: number

    predefinedReasons?: AbusePredefinedReasonsString[]

    startAt?: number
    endAt?: number
  }) {
    const path = '/api/v1/abuses'

    const video = options.videoId
      ? {
        id: options.videoId,
        startAt: options.startAt,
        endAt: options.endAt
      }
      : undefined

    const comment = options.commentId
      ? { id: options.commentId }
      : undefined

    const account = options.accountId
      ? { id: options.accountId }
      : undefined

    const body = {
      account,
      video,
      comment,

      reason: options.reason,
      predefinedReasons: options.predefinedReasons
    }

    return unwrapBody<{ abuse: { id: number } }>(this.postBodyRequest({
      ...options,

      path,
      fields: body,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))
  }

  getAdminList (options: OverrideCommandOptions & {
    start?: number
    count?: number
    sort?: string

    id?: number
    predefinedReason?: AbusePredefinedReasonsString
    search?: string
    filter?: AbuseFilter
    state?: AbuseStateType
    videoIs?: AbuseVideoIs
    searchReporter?: string
    searchReportee?: string
    searchVideo?: string
    searchVideoChannel?: string
  } = {}) {
    const toPick: (keyof typeof options)[] = [
      'count',
      'filter',
      'id',
      'predefinedReason',
      'search',
      'searchReportee',
      'searchReporter',
      'searchVideo',
      'searchVideoChannel',
      'sort',
      'start',
      'state',
      'videoIs'
    ]

    const path = '/api/v1/abuses'

    const defaultQuery = { sort: 'createdAt' }
    const query = { ...defaultQuery, ...pick(options, toPick) }

    return this.getRequestBody<ResultList<AdminAbuse>>({
      ...options,

      path,
      query,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  getUserList (options: OverrideCommandOptions & {
    start?: number
    count?: number
    sort?: string

    id?: number
    search?: string
    state?: AbuseStateType
  }) {
    const toPick: (keyof typeof options)[] = [
      'id',
      'search',
      'state',
      'start',
      'count',
      'sort'
    ]

    const path = '/api/v1/users/me/abuses'

    const defaultQuery = { sort: 'createdAt' }
    const query = { ...defaultQuery, ...pick(options, toPick) }

    return this.getRequestBody<ResultList<UserAbuse>>({
      ...options,

      path,
      query,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  update (options: OverrideCommandOptions & {
    abuseId: number
    body: AbuseUpdate
  }) {
    const { abuseId, body } = options
    const path = '/api/v1/abuses/' + abuseId

    return this.putBodyRequest({
      ...options,

      path,
      fields: body,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  delete (options: OverrideCommandOptions & {
    abuseId: number
  }) {
    const { abuseId } = options
    const path = '/api/v1/abuses/' + abuseId

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  listMessages (options: OverrideCommandOptions & {
    abuseId: number
  }) {
    const { abuseId } = options
    const path = '/api/v1/abuses/' + abuseId + '/messages'

    return this.getRequestBody<ResultList<AbuseMessage>>({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  deleteMessage (options: OverrideCommandOptions & {
    abuseId: number
    messageId: number
  }) {
    const { abuseId, messageId } = options
    const path = '/api/v1/abuses/' + abuseId + '/messages/' + messageId

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  addMessage (options: OverrideCommandOptions & {
    abuseId: number
    message: string
  }) {
    const { abuseId, message } = options
    const path = '/api/v1/abuses/' + abuseId + '/messages'

    return this.postBodyRequest({
      ...options,

      path,
      fields: { message },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

}
