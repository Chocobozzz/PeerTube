// Types used by plugins and ffmpeg-utils

import { FfprobeData } from 'fluent-ffmpeg'

export type EncoderOptionsBuilderParams = {
  input: string

  resolution: number

  // If PeerTube applies a filter, transcoding profile must not copy input stream
  canCopyAudio: boolean
  canCopyVideo: boolean

  fps: number

  // Could be undefined if we could not get input bitrate (some RTMP streams for example)
  inputBitrate: number
  inputRatio: number
  inputProbe: FfprobeData

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
