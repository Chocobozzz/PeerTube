import Bluebird from 'bluebird'
import { logger } from '@server/helpers/logger.js'
import { doRequest, PeerTubeRequestOptions } from '@server/helpers/requests.js'
import { BROADCAST_CONCURRENCY } from '@server/initializers/constants.js'

async function httpBroadcast (payload: {
  uris: string[]
  requestOptions: PeerTubeRequestOptions
}) {
  const { uris, requestOptions } = payload

  const badUrls: string[] = []
  const goodUrls: string[] = []

  await Bluebird.map(uris, async uri => {
    try {
      await doRequest(uri, requestOptions)
      goodUrls.push(uri)
    } catch (err) {
      logger.debug('HTTP broadcast to %s failed.', uri, { err })
      badUrls.push(uri)
    }
  }, { concurrency: BROADCAST_CONCURRENCY })

  return { goodUrls, badUrls }
}

export default httpBroadcast
