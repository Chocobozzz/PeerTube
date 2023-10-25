import { doRequest, PeerTubeRequestOptions } from '@server/helpers/requests.js'

async function httpUnicast (payload: {
  uri: string
  requestOptions: PeerTubeRequestOptions
}) {
  await doRequest(payload.uri, payload.requestOptions)
}

export default httpUnicast
