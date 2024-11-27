import { NgIf } from '@angular/common'
import { Component, Input } from '@angular/core'
import { AuthUser } from '@app/core'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { VideoDetails } from '@app/shared/shared-main/video/video-details.model'
import { VideoPrivacy, VideoState } from '@peertube/peertube-models'

@Component({
  selector: 'my-video-alert',
  templateUrl: './video-alert.component.html',
  standalone: true,
  styles: `my-alert { text-align: center }`,
  imports: [ NgIf, PTDatePipe, AlertComponent ]
})
export class VideoAlertComponent {
  @Input() user: AuthUser
  @Input() video: VideoDetails
  @Input() noPlaylistVideoFound: boolean

  getAlertWarning () {
    if (!this.video) return

    switch (this.video.state.id) {
      case VideoState.TO_TRANSCODE:
        return $localize`The video is being transcoded, it may not work properly.`

      case VideoState.TO_IMPORT:
        return $localize`The video is being imported, it will be available when the import is finished.`

      case VideoState.TO_MOVE_TO_FILE_SYSTEM:
        return $localize`The video is being moved to server file system, it may not work properly`

      case VideoState.TO_MOVE_TO_FILE_SYSTEM_FAILED:
        return $localize`Move to file system failed, this video may not work properly.`

      case VideoState.TO_MOVE_TO_EXTERNAL_STORAGE:
        return $localize`The video is being moved to an external server, it may not work properly.`

      case VideoState.TO_MOVE_TO_EXTERNAL_STORAGE_FAILED:
        return $localize`Move to external storage failed, this video may not work properly.`

      case VideoState.TO_EDIT:
        return $localize`The video is being edited, it may not work properly.`

      case VideoState.TRANSCODING_FAILED:
        return $localize`Transcoding failed, this video may not work properly.`
    }
  }

  hasVideoScheduledPublication () {
    return this.video?.scheduledUpdate !== undefined
  }

  isWaitingForLive () {
    return this.video?.state.id === VideoState.WAITING_FOR_LIVE
  }

  isLiveEnded () {
    return this.video?.state.id === VideoState.LIVE_ENDED
  }

  isVideoPasswordProtected () {
    return this.video?.privacy.id === VideoPrivacy.PASSWORD_PROTECTED
  }
}
