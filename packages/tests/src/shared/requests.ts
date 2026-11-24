import { ContextType } from '@peertube/peertube-models'
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import { activityPubContextify, buildGlobalHTTPHeaders } from '@peertube/peertube-server/core/helpers/activity-pub-utils.js'
import { buildDigest } from '@peertube/peertube-server/core/helpers/peertube-crypto.js'
import { doRequest } from '@peertube/peertube-server/core/helpers/requests.js'
import { HTTP_SIGNATURE } from '@peertube/peertube-server/core/initializers/constants.js'
import { readJsonSync } from 'fs-extra/esm'

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

export async function trySignedPOSTAPRequest (options: Parameters<typeof makeSignedPOSTAPRequest>[0]) {
  try {
    const { statusCode } = await makeSignedPOSTAPRequest(options)

    return statusCode
  } catch (err) {
    return err.statusCode as number
  }
}

export function loadAPKeys () {
  return readJsonSync(buildAbsoluteFixturePath('./ap-json/peertube/keys.json')) as { publicKey: string, privateKey: string }
}

export function buildPersonActor (options: {
  id: string
  publicKey: string
  preferredUsername?: string
  inbox?: string
}) {
  const { id, publicKey, preferredUsername = 'impersonator', inbox = id + '/inbox' } = options

  return {
    type: 'Person',
    id,
    preferredUsername,
    inbox,
    publicKey: {
      id: id + '#main-key',
      owner: id,
      publicKeyPem: publicKey
    }
  }
}
