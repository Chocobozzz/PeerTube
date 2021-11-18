import { VideoResolution } from '../file/video-resolution.enum'

// Types used by plugins and ffmpeg-utils

export type EncoderOptionsBuilderParams = {
  input: string

  resolution: VideoResolution

  // Could be null for "merge audio" transcoding
  fps?: number

  // Could be undefined if we could not get input bitrate (some RTMP streams for example)
  inputBitrate: number
  inputRatio: number

  // For lives
  streamNum?: number
}

export type EncoderOptionsBuilder = (params: EncoderOptionsBuilderParams) => Promise<EncoderOptions> | EncoderOptions

export interface EncoderOptions {
  copy?: boolean // Copy stream? Default to false

  scaleFilter?: {
    name: string
  }

  inputOptions?: string[]
  outputOptions?: string[]
}

// All our encoders

export interface EncoderProfile <T> {
  [ profile: string ]: T

  default: T
}

export type AvailableEncoders = {
  available: {
    live: {
      [ encoder: string ]: EncoderProfile<EncoderOptionsBuilder>
    }

    vod: {
      [ encoder: string ]: EncoderProfile<EncoderOptionsBuilder>
    }
  }

  encodersToTry: {
    vod: {
      video: string[]
      audio: string[]
    }

    live: {
      video: string[]
      audio: string[]
    }
  }
}
