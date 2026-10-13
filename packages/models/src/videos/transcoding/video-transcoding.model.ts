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

  // 3D packing of the frames given to the encoder declared by the container of the input (undefined for 2D videos)
  inputStereo3D?: VideoStereo3D

  // For lives
  streamNum?: number
}

export type VideoStereo3D = {
  // Type name of FFmpeg: 'side by side', 'top and bottom', 'frame alternate', 'checkerboard', 'interleaved lines'...
  type: string

  // The right eye comes first
  inverted: boolean
}

export type EncoderOptionsBuilder = (params: EncoderOptionsBuilderParams) => Promise<EncoderOptions> | EncoderOptions

export interface EncoderOptions {
  copy?: boolean // Copy stream? Default to false

  scaleFilter?: {
    name: string
  }

  // Additional video filters to apply (e.g., fps)
  videoFilters?: {
    name: string
    rawOptions?: string
  }[]

  inputOptions?: string[]
  outputOptions?: string[]
}

// All our encoders

export interface EncoderProfile<T> {
  [profile: string]: T

  default: T
}

export type AvailableEncoders = {
  available: {
    live: {
      [encoder: string]: EncoderProfile<EncoderOptionsBuilder>
    }

    vod: {
      [encoder: string]: EncoderProfile<EncoderOptionsBuilder>
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
