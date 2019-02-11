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
function bytes (value: number) {
  const format = dictionaryBytes.find(d => value < d.max) || dictionaryBytes[dictionaryBytes.length - 1]
  const calc = Math.floor(value / (format.max / 1024)).toString()

  return [ calc, format.type ]
}

function isMobile () {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

function buildVideoLink (time?: number, url?: string) {
  if (!url) url = window.location.origin + window.location.pathname.replace('/embed/', '/watch/')

  if (time) {
    const timeInt = Math.floor(time)

    const params = new URLSearchParams(window.location.search)
    params.set('start', secondsToTime(timeInt))

    return url + '?' + params.toString()
  }

  return url
}

function timeToInt (time: number | string) {
  if (!time) return 0
  if (typeof time === 'number') return time

  const reg = /^((\d+)h)?((\d+)m)?((\d+)s?)?$/
  const matches = time.match(reg)

  if (!matches) return 0

  const hours = parseInt(matches[2] || '0', 10)
  const minutes = parseInt(matches[4] || '0', 10)
  const seconds = parseInt(matches[6] || '0', 10)

  return hours * 3600 + minutes * 60 + seconds
}

function secondsToTime (seconds: number) {
  let time = ''

  let hours = Math.floor(seconds / 3600)
  if (hours >= 1) time = hours + 'h'

  seconds %= 3600
  let minutes = Math.floor(seconds / 60)
  if (minutes >= 1) time += minutes + 'm'

  seconds %= 60
  if (seconds >= 1) time += seconds + 's'

  return time
}

function buildVideoEmbed (embedUrl: string) {
  return '<iframe width="560" height="315" ' +
    'sandbox="allow-same-origin allow-scripts" ' +
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
  buildVideoLink,
  buildVideoEmbed,
  videoFileMaxByResolution,
  videoFileMinByResolution,
  copyToClipboard,
  isMobile,
  bytes
}
