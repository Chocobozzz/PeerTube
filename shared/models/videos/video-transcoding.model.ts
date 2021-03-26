import { VideoResolution } from './video-resolution.enum'

// Types used by plugins and ffmpeg-utils

export type EncoderOptionsBuilder = (params: {
  input: string
  resolution: VideoResolution
  fps?: number
  streamNum?: number
}) => Promise<EncoderOptions> | EncoderOptions

export interface EncoderOptions {
  copy?: boolean // Copy stream? Default to false

  outputOptions: string[]
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
