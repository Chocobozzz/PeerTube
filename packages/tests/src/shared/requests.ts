import { ContextType } from '@peertube/peertube-models'
import { activityPubContextify, buildGlobalHTTPHeaders } from '@peertube/peertube-server/core/helpers/activity-pub-utils.js'
import { buildDigest } from '@peertube/peertube-server/core/helpers/peertube-crypto.js'
import { doRequest } from '@peertube/peertube-server/core/helpers/requests.js'
import { HTTP_SIGNATURE } from '@peertube/peertube-server/core/initializers/constants.js'

export function fakeContextFilter () {
  return (data: any) => Promise.resolve(data)
}

export function makePOSTAPRequest (url: string, body: any, httpSignature: any, headers: any) {
  return doRequest(url, {
    method: 'POST',
    json: body,
    httpSignature,
    headers,
    preventSSRF: false
  })
}

// Contextify the activity and send it with an HTTP signature
export async function makeSignedPOSTAPRequest (options: {
  url: string
  activity: any
  contextType: ContextType
  keyId: string
  privateKey: string
}) {
  const { url, activity, contextType, keyId, privateKey } = options

  const body = await activityPubContextify(activity, contextType, fakeContextFilter())
  const httpSignature = { keyId, key: privateKey, headers: HTTP_SIGNATURE.HEADERS_TO_SIGN_WITH_PAYLOAD }

  return makePOSTAPRequest(url, body, httpSignature, buildGlobalHTTPHeaders(body, buildDigest))
}
