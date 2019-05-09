import { doRequest } from '../../../server/helpers/requests'
import { HTTP_SIGNATURE } from '../../../server/initializers/constants'
import { buildGlobalHeaders } from '../../../server/lib/job-queue/handlers/utils/activitypub-http-utils'
import { activityPubContextify } from '../../../server/helpers/activitypub'

function makePOSTAPRequest (url: string, body: any, httpSignature: any, headers: any) {
  const options = {
    method: 'POST',
    uri: url,
    json: body,
    httpSignature,
    headers
  }

  return doRequest(options)
}

async function makeFollowRequest (to: { url: string }, by: { url: string, privateKey }) {
  const follow = {
    type: 'Follow',
    id: by.url + '/toto',
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
  const headers = buildGlobalHeaders(body)

  return makePOSTAPRequest(to.url, body, httpSignature, headers)
}

export {
  makePOSTAPRequest,
  makeFollowRequest
}
