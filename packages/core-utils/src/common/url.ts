import { Video, VideoPlaylist } from '@peertube/peertube-models'
import { secondsToTime } from './date.js'

function addQueryParams (url: string, params: { [ id: string ]: string }) {
  const objUrl = new URL(url)

  for (const key of Object.keys(params)) {
    objUrl.searchParams.append(key, params[key])
  }

  return objUrl.toString()
}

function removeQueryParams (url: string) {
  const objUrl = new URL(url)

  objUrl.searchParams.forEach((_v, k) => objUrl.searchParams.delete(k))

  return objUrl.toString()
}

function queryParamsToObject (entries: URLSearchParams) {
  const result: { [ id: string ]: string | number | boolean } = {}

  for (const [ key, value ] of entries) {
    result[key] = value
  }

  return result
}

// ---------------------------------------------------------------------------

function buildPlaylistLink (playlist: Pick<VideoPlaylist, 'shortUUID'>, base?: string) {
  return (base ?? window.location.origin) + buildPlaylistWatchPath(playlist)
}

function buildPlaylistWatchPath (playlist: Pick<VideoPlaylist, 'shortUUID'>) {
  return '/w/p/' + playlist.shortUUID
}

function buildVideoWatchPath (video: Pick<Video, 'shortUUID'>) {
  return '/w/' + video.shortUUID
}

function buildVideoLink (video: Pick<Video, 'shortUUID'>, base?: string) {
  return (base ?? window.location.origin) + buildVideoWatchPath(video)
}

function buildPlaylistEmbedPath (playlist: Partial<Pick<VideoPlaylist, 'shortUUID' | 'uuid'>>) {
  return '/video-playlists/embed/' + (playlist.shortUUID || playlist.uuid)
}

function buildPlaylistEmbedLink (playlist: Partial<Pick<VideoPlaylist, 'shortUUID' | 'uuid'>>, base?: string) {
  return (base ?? window.location.origin) + buildPlaylistEmbedPath(playlist)
}

function buildVideoEmbedPath (video: Partial<Pick<Video, 'shortUUID' | 'uuid'>>) {
  return '/videos/embed/' + (video.shortUUID || video.uuid)
}

function buildVideoEmbedLink (video: Partial<Pick<Video, 'shortUUID' | 'uuid'>>, base?: string) {
  return (base ?? window.location.origin) + buildVideoEmbedPath(video)
}

function decorateVideoLink (options: {
  url: string

  startTime?: number
  stopTime?: number

  subtitle?: string

  loop?: boolean
  autoplay?: boolean
  muted?: boolean

  // Embed options
  title?: boolean
  warningTitle?: boolean

  controls?: boolean
  controlBar?: boolean

  peertubeLink?: boolean
  p2p?: boolean

  api?: boolean
}) {
  const { url } = options

  const params = new URLSearchParams()

  if (options.startTime !== undefined && options.startTime !== null) {
    const startTimeInt = Math.floor(options.startTime)
    params.set('start', secondsToTime(startTimeInt))
  }

  if (options.stopTime) {
    const stopTimeInt = Math.floor(options.stopTime)
    params.set('stop', secondsToTime(stopTimeInt))
  }

  if (options.subtitle) params.set('subtitle', options.subtitle)

  if (options.loop === true) params.set('loop', '1')
  if (options.autoplay === true) params.set('autoplay', '1')
  if (options.muted === true) params.set('muted', '1')
  if (options.title === false) params.set('title', '0')
  if (options.warningTitle === false) params.set('warningTitle', '0')

  if (options.controls === false) params.set('controls', '0')
  if (options.controlBar === false) params.set('controlBar', '0')

  if (options.peertubeLink === false) params.set('peertubeLink', '0')
  if (options.p2p !== undefined) params.set('p2p', options.p2p ? '1' : '0')

  if (options.api !== undefined) params.set('api', options.api ? '1' : '0')

  return buildUrl(url, params)
}

function decoratePlaylistLink (options: {
  url: string

  playlistPosition?: number
}) {
  const { url } = options

  const params = new URLSearchParams()

  if (options.playlistPosition) params.set('playlistPosition', '' + options.playlistPosition)

  return buildUrl(url, params)
}

// ---------------------------------------------------------------------------

export {
  addQueryParams,
  removeQueryParams,
  queryParamsToObject,

  buildPlaylistLink,
  buildVideoLink,

  buildVideoWatchPath,
  buildPlaylistWatchPath,

  buildPlaylistEmbedPath,
  buildVideoEmbedPath,

  buildPlaylistEmbedLink,
  buildVideoEmbedLink,

  decorateVideoLink,
  decoratePlaylistLink
}

function buildUrl (url: string, params: URLSearchParams) {
  let hasParams = false
  params.forEach(() => { hasParams = true })

  if (hasParams) return url + '?' + params.toString()

  return url
}
