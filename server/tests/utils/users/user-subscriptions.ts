import { makeDeleteRequest, makeGetRequest, makePostBodyRequest } from '../'

function addUserSubscription (url: string, token: string, targetUri: string, statusCodeExpected = 204) {
  const path = '/api/v1/users/me/subscriptions'

  return makePostBodyRequest({
    url,
    path,
    token,
    statusCodeExpected,
    fields: { uri: targetUri }
  })
}

function listUserSubscriptions (url: string, token: string, sort = '-createdAt', statusCodeExpected = 200) {
  const path = '/api/v1/users/me/subscriptions'

  return makeGetRequest({
    url,
    path,
    token,
    statusCodeExpected,
    query: { sort }
  })
}

function listUserSubscriptionVideos (url: string, token: string, sort = '-createdAt', statusCodeExpected = 200) {
  const path = '/api/v1/users/me/subscriptions/videos'

  return makeGetRequest({
    url,
    path,
    token,
    statusCodeExpected,
    query: { sort }
  })
}

function getUserSubscription (url: string, token: string, uri: string, statusCodeExpected = 200) {
  const path = '/api/v1/users/me/subscriptions/' + uri

  return makeGetRequest({
    url,
    path,
    token,
    statusCodeExpected
  })
}

function removeUserSubscription (url: string, token: string, uri: string, statusCodeExpected = 204) {
  const path = '/api/v1/users/me/subscriptions/' + uri

  return makeDeleteRequest({
    url,
    path,
    token,
    statusCodeExpected
  })
}

function areSubscriptionsExist (url: string, token: string, uris: string[], statusCodeExpected = 200) {
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
