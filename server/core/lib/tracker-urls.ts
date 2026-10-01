import { uniqify } from '@peertube/peertube-core-utils'
import { isWebSocketTrackerUrl } from '@server/helpers/custom-validators/urls.js'
import { CONFIG } from '@server/initializers/config.js'
import { LOCAL_TRACKER_URLS_KEYWORD, WEBSERVER } from '@server/initializers/constants.js'

export function buildLocalTrackerUrls () {
  return uniqify(
    CONFIG.TRACKER.URLS.flatMap(url => {
      if (url === LOCAL_TRACKER_URLS_KEYWORD) return [ buildBuiltInTrackerHttpUrl(), buildBuiltInTrackerWebSocketUrl() ]

      return [ normalizeUrlScheme(url) ]
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

// Clients expect lower case schemes
function normalizeUrlScheme (url: string) {
  return url.replace(/^[a-z]+(?=:\/\/)/i, scheme => scheme.toLowerCase())
}

function buildBuiltInTrackerHttpUrl () {
  return WEBSERVER.URL + '/tracker/announce'
}

function buildBuiltInTrackerWebSocketUrl () {
  return WEBSERVER.WS + '://' + WEBSERVER.HOSTNAME + ':' + WEBSERVER.PORT + '/tracker/socket'
}
