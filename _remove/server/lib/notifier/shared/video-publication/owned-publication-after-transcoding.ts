import { AbstractOwnedVideoPublication } from './abstract-owned-video-publication'

export class OwnedPublicationAfterTranscoding extends AbstractOwnedVideoPublication {

  isDisabled () {
    // Don't notify if didn't wait for transcoding or video is still blacklisted/waiting for scheduled update
    return !this.payload.waitTranscoding || !!this.payload.VideoBlacklist || !!this.payload.ScheduleVideoUpdate
  }
}
