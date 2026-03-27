import { logger } from '@root-helpers/logger'
import { peertubeLocalStorage, peertubeSessionStorage } from '@root-helpers/peertube-web-storage'
import { randomString } from '@root-helpers/string'

export function getStoredPlaybackRate () {
  return parseLocalStorageFloat(getLocalStorage('playback-rate'))
}

export function savePlaybackRateInStore (value: number) {
  return setLocalStorage('playback-rate', value.toString())
}

// ---------------------------------------------------------------------------

export function getStoredVolume () {
  return parseLocalStorageFloat(getLocalStorage('volume'))
}

export function saveVolumeInStore (value: number) {
  return setLocalStorage('volume', value.toString())
}

// ---------------------------------------------------------------------------

export function getStoredMute () {
  return parseLocalStorageBool(getLocalStorage('mute'))
}

export function saveMuteInStore (value: boolean) {
  return setLocalStorage('mute', value.toString())
}

// ---------------------------------------------------------------------------

export function getStoredTheater () {
  return parseLocalStorageBool(getLocalStorage('theater-enabled'))
}

export function saveTheaterInStore (enabled: boolean) {
  return setLocalStorage('theater-enabled', enabled.toString())
}

// ---------------------------------------------------------------------------

export function saveAverageBandwidth (value: number) {
  /** used to choose the most fitting resolution */
  return setLocalStorage('average-bandwidth', value.toString())
}

export function getAverageBandwidthInStore () {
  return parseLocalStorageInt(getLocalStorage('average-bandwidth'))
}

// ---------------------------------------------------------------------------

export function saveLastSubtitle (language: string) {
  return setLocalStorage('last-subtitle', language)
}

export function getStoredLastSubtitle () {
  return getLocalStorage('last-subtitle')
}

export function savePreferredSubtitle (language: string) {
  return setLocalStorage('preferred-subtitle', language)
}

export function getStoredPreferredSubtitle () {
  return getLocalStorage('preferred-subtitle')
}

// ---------------------------------------------------------------------------

export function saveVideoWatchHistory (videoUUID: string, duration: number) {
  return setLocalStorage(
    `video-watch-history`,
    JSON.stringify({
      ...getStoredVideoWatchHistory(),

      [videoUUID]: {
        duration,
        date: `${(new Date()).toISOString()}`
      }
    })
  )
}

export function getStoredVideoWatchHistory (videoUUID?: string) {
  let data

  try {
    const value = getLocalStorage('video-watch-history')
    if (!value) return {}

    data = JSON.parse(value)
  } catch (error) {
    logger.error('Cannot parse video watch history from local storage/', error)
  }

  data = data || {}

  if (videoUUID) return data[videoUUID]

  return data
}

export function cleanupVideoWatch () {
  const data = getStoredVideoWatchHistory()
  if (!data) return

  const newData = Object.keys(data).reduce((acc, videoUUID) => {
    const date = Date.parse(data[videoUUID].date)

    const diff = Math.ceil(((new Date()).getTime() - date) / (1000 * 3600 * 24))

    if (diff > 30) return acc

    return {
      ...acc,
      [videoUUID]: data[videoUUID]
    }
  }, {})

  setLocalStorage('video-watch-history', JSON.stringify(newData))
}

// ---------------------------------------------------------------------------

export function getPlayerSessionId () {
  const key = 'session-id'

  let sessionId = getSessionStorage(key)
  if (sessionId) return sessionId

  sessionId = randomString(32)
  setSessionStorage(key, sessionId)

  return sessionId
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

const KEY_PREFIX = 'peertube-videojs-'

function getLocalStorage (key: string) {
  return peertubeLocalStorage.getItem(KEY_PREFIX + key)
}

function setLocalStorage (key: string, value: string) {
  peertubeLocalStorage.setItem(KEY_PREFIX + key, value)
}

function getSessionStorage (key: string) {
  return peertubeSessionStorage.getItem(KEY_PREFIX + key)
}

function setSessionStorage (key: string, value: string) {
  peertubeSessionStorage.setItem(KEY_PREFIX + key, value)
}

function parseLocalStorageFloat (value: string) {
  if (value !== null && value !== undefined) {
    const valueNumber = parseFloat(value)
    if (isNaN(valueNumber)) return undefined

    return valueNumber
  }

  return undefined
}

function parseLocalStorageInt (value: string) {
  if (value !== null && value !== undefined) {
    const valueNumber = parseInt(value, 10)
    if (isNaN(valueNumber)) return undefined

    return valueNumber
  }

  return undefined
}

function parseLocalStorageBool (value: string) {
  if (value !== null && value !== undefined) return value === 'true'

  return undefined
}
