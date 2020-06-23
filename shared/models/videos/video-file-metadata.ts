import { FfprobeData } from 'fluent-ffmpeg'
import { DeepOmit } from '../../core-utils'

export type VideoFileMetadataModel = DeepOmit<FfprobeData, 'filename'>

export class VideoFileMetadata implements VideoFileMetadataModel {
  streams: { [x: string]: any, [x: number]: any }[]
  format: { [x: string]: any, [x: number]: any }
  chapters: any[]

  constructor (hash: Partial<VideoFileMetadataModel>) {
    this.chapters = hash.chapters
    this.format = hash.format
    this.streams = hash.streams

    delete this.format.filename
  }
}
