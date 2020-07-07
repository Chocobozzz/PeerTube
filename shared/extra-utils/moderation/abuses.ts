
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

function getAbusesList (options: {
  url: string
  token: string
  id?: number
  predefinedReason?: AbusePredefinedReasonsString
  search?: string
  filter?: AbuseFilter,
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
    sort: 'createdAt',
    id,
    predefinedReason,
    search,
    state,
    filter,
    videoIs,
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

// ---------------------------------------------------------------------------

export {
  reportAbuse,
  getAbusesList,
  updateAbuse,
  deleteAbuse
}
