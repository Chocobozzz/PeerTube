function getStoredVolume () {
  const value = getLocalStorage('volume')
  if (value !== null && value !== undefined) {
    const valueNumber = parseFloat(value)
    if (isNaN(valueNumber)) return undefined

    return valueNumber
  }

  return undefined
}

function getStoredMute () {
  const value = getLocalStorage('mute')
  if (value !== null && value !== undefined) return value === 'true'

  return undefined
}

function getStoredTheater () {
  const value = getLocalStorage('theater-enabled')
  if (value !== null && value !== undefined) return value === 'true'

  return undefined
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


// ---------------------------------------------------------------------------

export {
  getStoredVolume,
  getStoredMute,
  getStoredTheater,
  saveVolumeInStore,
  saveMuteInStore,
  saveTheaterInStore,
  saveAverageBandwidth,
  getAverageBandwidthInStore
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
