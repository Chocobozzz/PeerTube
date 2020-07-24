
import { AbuseFilter, AbusePredefinedReasonsString, AbuseState, AbuseUpdate, AbuseVideoIs } from '@shared/models'
import { makeDeleteRequest, makeGetRequest, makePostBodyRequest, makePutBodyRequest } from '../requests/requests'

function reportAbuse (options: {
  url: string
  token: string

  reason: string

  accountId?: number
  videoId?: number
  commentId?: number

  predefinedReasons?: AbusePredefinedReasonsString[]

  startAt?: number
  endAt?: number

  statusCodeExpected?: number
}) {
  const path = '/api/v1/abuses'

  const video = options.videoId ? {
    id: options.videoId,
    startAt: options.startAt,
    endAt: options.endAt
  } : undefined

  const comment = options.commentId ? {
    id: options.commentId
  } : undefined

  const account = options.accountId ? {
    id: options.accountId
  } : undefined

  const body = {
    account,
    video,
    comment,

    reason: options.reason,
    predefinedReasons: options.predefinedReasons
  }

  return makePostBodyRequest({
    url: options.url,
    path,
    token: options.token,

    fields: body,
    statusCodeExpected: options.statusCodeExpected || 200
  })
}

function getAdminAbusesList (options: {
  url: string
  token: string

  start?: number
  count?: number
  sort?: string

  id?: number
  predefinedReason?: AbusePredefinedReasonsString
  search?: string
  filter?: AbuseFilter
  state?: AbuseState
  videoIs?: AbuseVideoIs
  searchReporter?: string
  searchReportee?: string
  searchVideo?: string
  searchVideoChannel?: string
}) {
  const {
    url,
    token,
    start,
    count,
    sort,
    id,
    predefinedReason,
    search,
    filter,
    state,
    videoIs,
    searchReporter,
    searchReportee,
    searchVideo,
    searchVideoChannel
  } = options
  const path = '/api/v1/abuses'

  const query = {
    id,
    predefinedReason,
    search,
    state,
    filter,
    videoIs,
    start,
    count,
    sort: sort || 'createdAt',
    searchReporter,
    searchReportee,
    searchVideo,
    searchVideoChannel
  }

  return makeGetRequest({
    url,
    path,
    token,
    query,
    statusCodeExpected: 200
  })
}

function getUserAbusesList (options: {
  url: string
  token: string

  start?: number
  count?: number
  sort?: string

  id?: number
  search?: string
  state?: AbuseState
}) {
  const {
    url,
    token,
    start,
    count,
    sort,
    id,
    search,
    state
  } = options
  const path = '/api/v1/users/me/abuses'

  const query = {
    id,
    search,
    state,
    start,
    count,
    sort: sort || 'createdAt'
  }

  return makeGetRequest({
    url,
    path,
    token,
    query,
    statusCodeExpected: 200
  })
}

function updateAbuse (
  url: string,
  token: string,
  abuseId: number,
  body: AbuseUpdate,
  statusCodeExpected = 204
) {
  const path = '/api/v1/abuses/' + abuseId

  return makePutBodyRequest({
    url,
    token,
    path,
    fields: body,
    statusCodeExpected
  })
}

function deleteAbuse (url: string, token: string, abuseId: number, statusCodeExpected = 204) {
  const path = '/api/v1/abuses/' + abuseId

  return makeDeleteRequest({
    url,
    token,
    path,
    statusCodeExpected
  })
}

function listAbuseMessages (url: string, token: string, abuseId: number, statusCodeExpected = 200) {
  const path = '/api/v1/abuses/' + abuseId + '/messages'

  return makeGetRequest({
    url,
    token,
    path,
    statusCodeExpected
  })
}

function deleteAbuseMessage (url: string, token: string, abuseId: number, messageId: number, statusCodeExpected = 204) {
  const path = '/api/v1/abuses/' + abuseId + '/messages/' + messageId

  return makeDeleteRequest({
    url,
    token,
    path,
    statusCodeExpected
  })
}

function addAbuseMessage (url: string, token: string, abuseId: number, message: string, statusCodeExpected = 200) {
  const path = '/api/v1/abuses/' + abuseId + '/messages'

  return makePostBodyRequest({
    url,
    token,
    path,
    fields: { message },
    statusCodeExpected
  })
}

// ---------------------------------------------------------------------------

export {
  reportAbuse,
  getAdminAbusesList,
  updateAbuse,
  deleteAbuse,
  getUserAbusesList,
  listAbuseMessages,
  deleteAbuseMessage,
  addAbuseMessage
}
