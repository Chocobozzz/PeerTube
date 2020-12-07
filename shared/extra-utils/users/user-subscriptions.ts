import { makeDeleteRequest, makeGetRequest, makePostBodyRequest } from '../requests/requests'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

function addUserSubscription (url: string, token: string, targetUri: string, statusCodeExpected = HttpStatusCode.NO_CONTENT_204) {
  const path = '/api/v1/users/me/subscriptions'

  return makePostBodyRequest({
    url,
    path,
    token,
    statusCodeExpected,
    fields: { uri: targetUri }
  })
}

function listUserSubscriptions (parameters: {
  url: string
  token: string
  sort?: string
  search?: string
  statusCodeExpected?: number
}) {
  const { url, token, sort = '-createdAt', search, statusCodeExpected = HttpStatusCode.OK_200 } = parameters
  const path = '/api/v1/users/me/subscriptions'

  return makeGetRequest({
    url,
    path,
    token,
    statusCodeExpected,
    query: {
      sort,
      search
    }
  })
}

function listUserSubscriptionVideos (url: string, token: string, sort = '-createdAt', statusCodeExpected = HttpStatusCode.OK_200) {
  const path = '/api/v1/users/me/subscriptions/videos'

  return makeGetRequest({
    url,
    path,
    token,
    statusCodeExpected,
    query: { sort }
  })
}

function getUserSubscription (url: string, token: string, uri: string, statusCodeExpected = HttpStatusCode.OK_200) {
  const path = '/api/v1/users/me/subscriptions/' + uri

  return makeGetRequest({
    url,
    path,
    token,
    statusCodeExpected
  })
}

function removeUserSubscription (url: string, token: string, uri: string, statusCodeExpected = HttpStatusCode.NO_CONTENT_204) {
  const path = '/api/v1/users/me/subscriptions/' + uri

  return makeDeleteRequest({
    url,
    path,
    token,
    statusCodeExpected
  })
}

function areSubscriptionsExist (url: string, token: string, uris: string[], statusCodeExpected = HttpStatusCode.OK_200) {
  const path = '/api/v1/users/me/subscriptions/exist'

  return makeGetRequest({
    url,
    path,
    query: { 'uris[]': uris },
    token,
    statusCodeExpected
  })
}

// ---------------------------------------------------------------------------

export {
  areSubscriptionsExist,
  addUserSubscription,
  listUserSubscriptions,
  getUserSubscription,
  listUserSubscriptionVideos,
  removeUserSubscription
}
