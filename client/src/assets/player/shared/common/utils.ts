import { VideoFile } from '@shared/models'

function toTitleCase (str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

const dictionaryBytes = [
  { max: 1024, type: 'B', decimals: 0 },
  { max: 1048576, type: 'KB', decimals: 0 },
  { max: 1073741824, type: 'MB', decimals: 0 },
  { max: 1.0995116e12, type: 'GB', decimals: 1 }
]
function bytes (value: number) {
  const format = dictionaryBytes.find(d => value < d.max) || dictionaryBytes[dictionaryBytes.length - 1]
  const calc = (value / (format.max / 1024)).toFixed(format.decimals)

  return [ calc, format.type ]
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

function isSameOrigin (current: string, target: string) {
  return new URL(current).origin === new URL(target).origin
}

// ---------------------------------------------------------------------------

export {
  getRtcConfig,
  toTitleCase,

  videoFileMaxByResolution,
  videoFileMinByResolution,
  bytes,

  isSameOrigin
}
