import { Video } from '@app/shared/shared-main/video/video.model'
import { VideoPlaylistElement as ServerVideoPlaylistElement, VideoPlaylistElementType_Type } from '@peertube/peertube-models'

export class VideoPlaylistElement implements ServerVideoPlaylistElement {
  id: number
  position: number
  startTimestamp: number
  stopTimestamp: number

  type: VideoPlaylistElementType_Type

  video?: Video

  constructor (hash: ServerVideoPlaylistElement, translations: { [ id: string ]: string } = {}) {
    this.id = hash.id
    this.position = hash.position
    this.startTimestamp = hash.startTimestamp
    this.stopTimestamp = hash.stopTimestamp

    this.type = hash.type

    if (hash.video) this.video = new Video(hash.video, translations)
  }
}
