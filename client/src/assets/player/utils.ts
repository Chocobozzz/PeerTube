import { VideoFile } from '../../../../shared/models/videos'

function toTitleCase (str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function isWebRTCDisabled () {
  return !!((window as any).RTCPeerConnection || (window as any).mozRTCPeerConnection || (window as any).webkitRTCPeerConnection) === false
}

function isIOS () {
  return !!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform)
}

function isSafari () {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
}

// https://github.com/danrevah/ngx-pipes/blob/master/src/pipes/math/bytes.ts
// Don't import all Angular stuff, just copy the code with shame
const dictionaryBytes: Array<{max: number, type: string}> = [
  { max: 1024, type: 'B' },
  { max: 1048576, type: 'KB' },
  { max: 1073741824, type: 'MB' },
  { max: 1.0995116e12, type: 'GB' }
]
function bytes (value: number) {
  const format = dictionaryBytes.find(d => value < d.max) || dictionaryBytes[dictionaryBytes.length - 1]
  const calc = Math.floor(value / (format.max / 1024)).toString()

  return [ calc, format.type ]
}

function isMobile () {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

function buildVideoLink (options: {
  baseUrl?: string,

  startTime?: number,
  stopTime?: number,

  subtitle?: string,

  loop?: boolean,
  autoplay?: boolean,
  muted?: boolean,

  // Embed options
  title?: boolean,
  warningTitle?: boolean,
  controls?: boolean
} = {}) {
  const { baseUrl } = options

  const url = baseUrl
    ? baseUrl
    : window.location.origin + window.location.pathname.replace('/embed/', '/watch/')

  const params = new URLSearchParams(window.location.search)
  // Remove these unused parameters when we are on a playlist page
  params.delete('videoId')
  params.delete('resume')

  if (options.startTime) {
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

  let hasParams = false
  params.forEach(() => hasParams = true)

  if (hasParams) return url + '?' + params.toString()

  return url
}

function timeToInt (time: number | string) {
  if (!time) return 0
  if (typeof time === 'number') return time

  const reg = /^((\d+)[h:])?((\d+)[m:])?((\d+)s?)?$/
  const matches = time.match(reg)

  if (!matches) return 0

  const hours = parseInt(matches[2] || '0', 10)
  const minutes = parseInt(matches[4] || '0', 10)
  const seconds = parseInt(matches[6] || '0', 10)

  return hours * 3600 + minutes * 60 + seconds
}

function secondsToTime (seconds: number, full = false, symbol?: string) {
  let time = ''

  const hourSymbol = (symbol || 'h')
  const minuteSymbol = (symbol || 'm')
  const secondsSymbol = full ? '' : 's'

  const hours = Math.floor(seconds / 3600)
  if (hours >= 1) time = hours + hourSymbol
  else if (full) time = '0' + hourSymbol

  seconds %= 3600
  const minutes = Math.floor(seconds / 60)
  if (minutes >= 1 && minutes < 10 && full) time += '0' + minutes + minuteSymbol
  else if (minutes >= 1) time += minutes + minuteSymbol
  else if (full) time += '00' + minuteSymbol

  seconds %= 60
  if (seconds >= 1 && seconds < 10 && full) time += '0' + seconds + secondsSymbol
  else if (seconds >= 1) time += seconds + secondsSymbol
  else if (full) time += '00'

  return time
}

function buildVideoEmbed (embedUrl: string) {
  return '<iframe width="560" height="315" ' +
    'sandbox="allow-same-origin allow-scripts allow-popups" ' +
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

function getRtcConfig () {
  return {
    iceServers: [
      {
        urls: 'stun:stun.stunprotocol.org'
      },
      {
        urls: 'stun:stun.framasoft.org'
      }
    ]
  }
}

// ---------------------------------------------------------------------------

export {
  getRtcConfig,
  toTitleCase,
  timeToInt,
  secondsToTime,
  isWebRTCDisabled,
  buildVideoLink,
  buildVideoEmbed,
  videoFileMaxByResolution,
  videoFileMinByResolution,
  copyToClipboard,
  isMobile,
  bytes,
  isIOS,
  isSafari
}
