import { buildDigest } from '@server/helpers/peertube-crypto'
import { doRequest } from '@server/helpers/requests'
import { ACTIVITY_PUB, HTTP_SIGNATURE } from '@server/initializers/constants'
import { activityPubContextify } from '@server/lib/activitypub/context'

export function makePOSTAPRequest (url: string, body: any, httpSignature: any, headers: any) {
  const options = {
    method: 'POST' as 'POST',
    json: body,
    httpSignature,
    headers
  }

  return doRequest(url, options)
}

export async function makeFollowRequest (to: { url: string }, by: { url: string, privateKey }) {
  const follow = {
    type: 'Follow',
    id: by.url + '/' + new Date().getTime(),
    actor: by.url,
    object: to.url
  }

  const body = activityPubContextify(follow)

  const httpSignature = {
    algorithm: HTTP_SIGNATURE.ALGORITHM,
    authorizationHeaderName: HTTP_SIGNATURE.HEADER_NAME,
    keyId: by.url,
    key: by.privateKey,
    headers: HTTP_SIGNATURE.HEADERS_TO_SIGN
  }
  const headers = {
    'digest': buildDigest(body),
    'content-type': 'application/activity+json',
    'accept': ACTIVITY_PUB.ACCEPT_HEADER
  }

  return makePOSTAPRequest(to.url + '/inbox', body, httpSignature, headers)
}
