import { HTMLServerConfig, Video, VideoFile } from '@peertube/peertube-models'

function toTitleCase (str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function isWebRTCDisabled () {
  return !!((window as any).RTCPeerConnection || (window as any).mozRTCPeerConnection || (window as any).webkitRTCPeerConnection) === false
}

function isP2PEnabled (video: Video, config: HTMLServerConfig, userP2PEnabled: boolean) {
  if (video.isLocal && config.tracker.enabled === false) return false
  if (isWebRTCDisabled()) return false

  return userP2PEnabled
}

function isIOS () {
  if (/iPad|iPhone|iPod/.test(navigator.platform)) {
    return true
  }

  // Detect iPad Desktop mode
  return !!(navigator.maxTouchPoints &&
      navigator.maxTouchPoints > 2 &&
      navigator.platform.includes('MacIntel'))
}

function isSafari () {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
}

// https://github.com/danrevah/ngx-pipes/blob/master/src/pipes/math/bytes.ts
// Don't import all Angular stuff, just copy the code with shame
const dictionaryBytes: { max: number, type: string }[] = [
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
  isWebRTCDisabled,
  isP2PEnabled,

  videoFileMaxByResolution,
  videoFileMinByResolution,
  isMobile,
  bytes,
  isIOS,
  isSafari
}
