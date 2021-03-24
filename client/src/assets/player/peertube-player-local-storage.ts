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

function saveVideoWatch(videoUUID: string, duration: number) {
  const data = getVideoWatch()
  const now = new Date()

  return setLocalStorage(`video-watch`, JSON.stringify({
    ...data,
    [videoUUID]: {
      duration,
      date: `${now.getFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`
    }
  }))
}

function getVideoWatch(videoUUID?: string) {
  let data

  try {
    data = JSON.parse(getLocalStorage('video-watch'))
  } catch (error) {
    console.error(error)
  }

  data = data || {}

  if (videoUUID) return data[videoUUID]

  return data
}

function cleanupVideoWatch() {
  const data = getVideoWatch()

  const newData = Object.keys(data).reduce((acc, videoUUID) => {
    const date = Date.parse(data[videoUUID].date)

    const diff = Math.ceil(((new Date()).getTime() - date) / (1000 * 3600 * 24))

    if (diff > 30) return acc

    return {
      ...acc,
      [videoUUID]: data[videoUUID]
    }
  }, {})

  setLocalStorage('video-watch', JSON.stringify(newData))
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
  saveVideoWatch,
  getVideoWatch,
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
