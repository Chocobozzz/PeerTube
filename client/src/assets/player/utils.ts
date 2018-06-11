import { is18nLocale, isDefaultLocale } from '../../../../shared/models/i18n/i18n'
import { VideoFile } from '../../../../shared/models/videos'

function toTitleCase (str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// https://github.com/danrevah/ngx-pipes/blob/master/src/pipes/math/bytes.ts
// Don't import all Angular stuff, just copy the code with shame
const dictionaryBytes: Array<{max: number, type: string}> = [
  { max: 1024, type: 'B' },
  { max: 1048576, type: 'KB' },
  { max: 1073741824, type: 'MB' },
  { max: 1.0995116e12, type: 'GB' }
]
function bytes (value) {
  const format = dictionaryBytes.find(d => value < d.max) || dictionaryBytes[dictionaryBytes.length - 1]
  const calc = Math.floor(value / (format.max / 1024)).toString()

  return [ calc, format.type ]
}

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

function getAverageBandwidth () {
  const value = getLocalStorage('average-bandwidth')
  if (value !== null && value !== undefined) {
    const valueNumber = parseInt(value, 10)
    if (isNaN(valueNumber)) return undefined

    return valueNumber
  }

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

function isMobile () {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

function buildVideoLink (time?: number) {
  let href = window.location.href.replace('/embed/', '/watch/')
  if (time) {
    const timeInt = Math.floor(time)

    if (window.location.search) href += '&start=' + timeInt
    else href += '?start=' + timeInt
  }

  return href
}

function buildVideoEmbed (embedUrl: string) {
  return '<iframe width="560" height="315" ' +
    'src="' + embedUrl + '" ' +
    'frameborder="0" allowfullscreen>' +
    '</iframe>'
}

function copyToClipboard (text: string) {
  const el = document.createElement('textarea')
  el.value = text
  el.setAttribute('readonly', '')
  el.style.position = 'absolute'
  el.style.left = '-9999px'
  document.body.appendChild(el)
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
}

function videoFileMaxByResolution (files: VideoFile[]) {
  let max = files[0]

  for (let i = 1; i < files.length; i++) {
    const file = files[i]
    if (max.resolution.id < file.resolution.id) max = file
  }

  return max
}

function videoFileMinByResolution (files: VideoFile[]) {
  let min = files[0]

  for (let i = 1; i < files.length; i++) {
    const file = files[i]
    if (min.resolution.id > file.resolution.id) min = file
  }

  return min
}

export {
  toTitleCase,
  buildVideoLink,
  getStoredVolume,
  saveVolumeInStore,
  saveAverageBandwidth,
  getAverageBandwidth,
  saveMuteInStore,
  buildVideoEmbed,
  getStoredMute,
  videoFileMaxByResolution,
  videoFileMinByResolution,
  copyToClipboard,
  getStoredTheater,
  saveTheaterInStore,
  isMobile,
  bytes
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
  } catch { /* empty */ }
}
