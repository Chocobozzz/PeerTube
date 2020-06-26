import { Video } from '@app/shared/shared-main'
import { VideoPlaylistElement as ServerVideoPlaylistElement, VideoPlaylistElementType } from '@shared/models'

export class VideoPlaylistElement implements ServerVideoPlaylistElement {
  id: number
  position: number
  startTimestamp: number
  stopTimestamp: number

  type: VideoPlaylistElementType

  video?: Video

  constructor (hash: ServerVideoPlaylistElement, translations: {}) {
    this.id = hash.id
    this.position = hash.position
    this.startTimestamp = hash.startTimestamp
    this.stopTimestamp = hash.stopTimestamp

    this.type = hash.type

    if (hash.video) this.video = new Video(hash.video, translations)
  }
}
