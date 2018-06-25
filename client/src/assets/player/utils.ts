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

// ---------------------------------------------------------------------------

export {
  toTitleCase,
  buildVideoLink,
  buildVideoEmbed,
  videoFileMaxByResolution,
  videoFileMinByResolution,
  copyToClipboard,
  isMobile,
  bytes
}
