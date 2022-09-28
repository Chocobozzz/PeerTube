import { map } from 'bluebird'
import { logger } from '@server/helpers/logger'
import { doRequest, PeerTubeRequestOptions } from '@server/helpers/requests'
import { BROADCAST_CONCURRENCY } from '@server/initializers/constants'

async function httpBroadcast (payload: {
  uris: string[]
  requestOptions: PeerTubeRequestOptions
}) {
  const { uris, requestOptions } = payload

  const badUrls: string[] = []
  const goodUrls: string[] = []

  await map(uris, async uri => {
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

module.exports = httpBroadcast

export {
  httpBroadcast
}
