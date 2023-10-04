import { VideoState } from '@peertube/peertube-models'
import { AbstractOwnedVideoPublication } from './abstract-owned-video-publication.js'

export class OwnedPublicationAfterScheduleUpdate extends AbstractOwnedVideoPublication {

  isDisabled () {
    // Don't notify if video is still blacklisted or waiting for transcoding
    return !!this.payload.VideoBlacklist || (this.payload.waitTranscoding && this.payload.state !== VideoState.PUBLISHED)
  }
}
