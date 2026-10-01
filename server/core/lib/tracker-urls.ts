import { uniqify } from '@peertube/peertube-core-utils'
import { isWebSocketTrackerUrl } from '@server/helpers/custom-validators/urls.js'
import { CONFIG } from '@server/initializers/config.js'
import { WEBSERVER } from '@server/initializers/constants.js'

// Custom tracker config keyword to specify the local tracker built-in in PeerTube
export const LOCAL_TRACKER_URLS_KEYWORD = 'local'

export function buildLocalTrackerUrls () {
  return uniqify(
    CONFIG.TRACKER.URLS.flatMap(url => {
      if (url === LOCAL_TRACKER_URLS_KEYWORD) return [ buildBuiltInTrackerHttpUrl(), buildBuiltInTrackerWebSocketUrl() ]

      return [ url ]
    })
  )
}

export function buildLocalAnnounceList () {
  const urls = buildLocalTrackerUrls()

  // Websocket trackers first so web browsers find peers quickly
  return [
    ...urls.filter(u => isWebSocketTrackerUrl(u)),
    ...urls.filter(u => !isWebSocketTrackerUrl(u))
  ].map(u => [ u ])
}

// ---------------------------------------------------------------------------

function buildBuiltInTrackerHttpUrl () {
  return WEBSERVER.URL + '/tracker/announce'
}

function buildBuiltInTrackerWebSocketUrl () {
  return WEBSERVER.WS + '://' + WEBSERVER.HOSTNAME + ':' + WEBSERVER.PORT + '/tracker/socket'
}
