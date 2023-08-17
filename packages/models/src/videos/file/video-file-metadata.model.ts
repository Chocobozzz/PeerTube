export class VideoFileMetadata {
  streams: { [x: string]: any, [x: number]: any }[]
  format: { [x: string]: any, [x: number]: any }
  chapters: any[]

  constructor (hash: { chapters: any[], format: any, streams: any[] }) {
    this.chapters = hash.chapters
    this.format = hash.format
    this.streams = hash.streams

    delete this.format.filename
  }
}
