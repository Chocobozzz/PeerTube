import { ffprobe, FfprobeData } from 'fluent-ffmpeg'
import { VideoFileMetadata } from '@shared/models/videos'

/**
 *
 * Helpers to run ffprobe and extract data from the JSON output
 *
 */

function ffprobePromise (path: string) {
  return new Promise<FfprobeData>((res, rej) => {
    ffprobe(path, (err, data) => {
      if (err) return rej(err)

      return res(data)
    })
  })
}

async function isAudioFile (path: string, existingProbe?: FfprobeData) {
  const videoStream = await getVideoStreamFromFile(path, existingProbe)

  return !videoStream
}

async function getAudioStream (videoPath: string, existingProbe?: FfprobeData) {
  // without position, ffprobe considers the last input only
  // we make it consider the first input only
  // if you pass a file path to pos, then ffprobe acts on that file directly
  const data = existingProbe || await ffprobePromise(videoPath)

  if (Array.isArray(data.streams)) {
    const audioStream = data.streams.find(stream => stream['codec_type'] === 'audio')

    if (audioStream) {
      return {
        absolutePath: data.format.filename,
        audioStream,
        bitrate: parseInt(audioStream['bit_rate'] + '', 10)
      }
    }
  }

  return { absolutePath: data.format.filename }
}

function getMaxAudioBitrate (type: 'aac' | 'mp3' | string, bitrate: number) {
  const maxKBitrate = 384
  const kToBits = (kbits: number) => kbits * 1000

  // If we did not manage to get the bitrate, use an average value
  if (!bitrate) return 256

  if (type === 'aac') {
    switch (true) {
      case bitrate > kToBits(maxKBitrate):
        return maxKBitrate

      default:
        return -1 // we interpret it as a signal to copy the audio stream as is
    }
  }

  /*
    a 192kbit/sec mp3 doesn't hold as much information as a 192kbit/sec aac.
    That's why, when using aac, we can go to lower kbit/sec. The equivalences
    made here are not made to be accurate, especially with good mp3 encoders.
    */
  switch (true) {
    case bitrate <= kToBits(192):
      return 128

    case bitrate <= kToBits(384):
      return 256

    default:
      return maxKBitrate
  }
}

async function getVideoStreamSize (path: string, existingProbe?: FfprobeData): Promise<{ width: number, height: number }> {
  const videoStream = await getVideoStreamFromFile(path, existingProbe)

  return videoStream === null
    ? { width: 0, height: 0 }
    : { width: videoStream.width, height: videoStream.height }
}

async function getVideoFileResolution (path: string, existingProbe?: FfprobeData) {
  const size = await getVideoStreamSize(path, existingProbe)

  return {
    width: size.width,
    height: size.height,
    ratio: Math.max(size.height, size.width) / Math.min(size.height, size.width),
    resolution: Math.min(size.height, size.width),
    isPortraitMode: size.height > size.width
  }
}

async function getVideoFileFPS (path: string, existingProbe?: FfprobeData) {
  const videoStream = await getVideoStreamFromFile(path, existingProbe)
  if (videoStream === null) return 0

  for (const key of [ 'avg_frame_rate', 'r_frame_rate' ]) {
    const valuesText: string = videoStream[key]
    if (!valuesText) continue

    const [ frames, seconds ] = valuesText.split('/')
    if (!frames || !seconds) continue

    const result = parseInt(frames, 10) / parseInt(seconds, 10)
    if (result > 0) return Math.round(result)
  }

  return 0
}

async function getMetadataFromFile (path: string, existingProbe?: FfprobeData) {
  const metadata = existingProbe || await ffprobePromise(path)

  return new VideoFileMetadata(metadata)
}

async function getVideoFileBitrate (path: string, existingProbe?: FfprobeData): Promise<number> {
  const metadata = await getMetadataFromFile(path, existingProbe)

  let bitrate = metadata.format.bit_rate as number
  if (bitrate && !isNaN(bitrate)) return bitrate

  const videoStream = await getVideoStreamFromFile(path, existingProbe)
  if (!videoStream) return undefined

  bitrate = videoStream?.bit_rate
  if (bitrate && !isNaN(bitrate)) return bitrate

  return undefined
}

async function getDurationFromVideoFile (path: string, existingProbe?: FfprobeData) {
  const metadata = await getMetadataFromFile(path, existingProbe)

  return Math.round(metadata.format.duration)
}

async function getVideoStreamFromFile (path: string, existingProbe?: FfprobeData) {
  const metadata = await getMetadataFromFile(path, existingProbe)

  return metadata.streams.find(s => s.codec_type === 'video') || null
}

async function canDoQuickAudioTranscode (path: string, probe?: FfprobeData): Promise<boolean> {
  const parsedAudio = await getAudioStream(path, probe)

  if (!parsedAudio.audioStream) return true

  if (parsedAudio.audioStream['codec_name'] !== 'aac') return false

  const audioBitrate = parsedAudio.bitrate
  if (!audioBitrate) return false

  const maxAudioBitrate = getMaxAudioBitrate('aac', audioBitrate)
  if (maxAudioBitrate !== -1 && audioBitrate > maxAudioBitrate) return false

  const channelLayout = parsedAudio.audioStream['channel_layout']
  // Causes playback issues with Chrome
  if (!channelLayout || channelLayout === 'unknown') return false

  return true
}

// ---------------------------------------------------------------------------

export {
  getVideoStreamSize,
  getVideoFileResolution,
  getMetadataFromFile,
  getMaxAudioBitrate,
  getVideoStreamFromFile,
  getDurationFromVideoFile,
  getAudioStream,
  getVideoFileFPS,
  isAudioFile,
  ffprobePromise,
  getVideoFileBitrate,
  canDoQuickAudioTranscode
}
