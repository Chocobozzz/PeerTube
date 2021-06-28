function getStoredVolume () {
  const value = getLocalStorage('volume')
  if (value !== null && value !== undefined) {
    const valueNumber = parseFloat(value)
    if (isNaN(valueNumber)) return undefined

    return valueNumber
  }

  return undefined
}

function getStoredP2PEnabled (): boolean {
  const value = getLocalStorage('webtorrent_enabled')
  if (value !== null && value !== undefined) return value === 'true'

  // By default webtorrent is enabled
  return true
}

function getStoredMute () {
  const value = getLocalStorage('mute')
  if (value !== null && value !== undefined) return value === 'true'

  return undefined
}

function getStoredTheater () {
  const value = getLocalStorage('theater-enabled')
  if (value !== null && value !== undefined) return value === 'true'

  return false
}

function saveVolumeInStore (value: number) {
  return setLocalStorage('volume', value.toString())
}

function saveMuteInStore (value: boolean) {
  return setLocalStorage('mute', value.toString())
}

function saveTheaterInStore (enabled: boolean) {
  return setLocalStorage('theater-enabled', enabled.toString())
}

function saveAverageBandwidth (value: number) {
  /** used to choose the most fitting resolution */
  return setLocalStorage('average-bandwidth', value.toString())
}

function getAverageBandwidthInStore () {
  const value = getLocalStorage('average-bandwidth')
  if (value !== null && value !== undefined) {
    const valueNumber = parseInt(value, 10)
    if (isNaN(valueNumber)) return undefined

    return valueNumber
  }

  return undefined
}

function saveLastSubtitle (language: string) {
  return setLocalStorage('last-subtitle', language)
}

function getStoredLastSubtitle () {
  return getLocalStorage('last-subtitle')
}

function saveVideoWatchHistory (videoUUID: string, duration: number) {
  return setLocalStorage(`video-watch-history`, JSON.stringify({
    ...getStoredVideoWatchHistory(),

    [videoUUID]: {
      duration,
      date: `${(new Date()).toISOString()}`
    }
  }))
}

function getStoredVideoWatchHistory (videoUUID?: string) {
  let data

  try {
    const value = getLocalStorage('video-watch-history')
    if (!value) return {}

    data = JSON.parse(value)
  } catch (error) {
    console.error('Cannot parse video watch history from local storage: ', error)
  }

  data = data || {}

  if (videoUUID) return data[videoUUID]

  return data
}

function cleanupVideoWatch () {
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

export {
  getStoredVolume,
  getStoredP2PEnabled,
  getStoredMute,
  getStoredTheater,
  saveVolumeInStore,
  saveMuteInStore,
  saveTheaterInStore,
  saveAverageBandwidth,
  getAverageBandwidthInStore,
  saveLastSubtitle,
  getStoredLastSubtitle,
  saveVideoWatchHistory,
  getStoredVideoWatchHistory,
  cleanupVideoWatch
}

// ---------------------------------------------------------------------------

const KEY_PREFIX = 'peertube-videojs-'

function getLocalStorage (key: string) {
  try {
    return localStorage.getItem(KEY_PREFIX + key)
  } catch {
    return undefined
  }
}

function setLocalStorage (key: string, value: string) {
  try {
    localStorage.setItem(KEY_PREFIX + key, value)
  } catch { /* empty */
  }
}
