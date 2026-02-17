import { Component, inject, input } from '@angular/core'
import { AuthUser } from '@app/core'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { VideoDetails } from '@app/shared/shared-main/video/video-details.model'
import { VideoStateMessageService } from '@app/shared/shared-video/video-state-message.service'
import { UserRight, VideoPrivacy, VideoState } from '@peertube/peertube-models'

@Component({
  selector: 'my-video-alert',
  templateUrl: './video-alert.component.html',
  styles: `my-alert { text-align: center }`,
  imports: [ PTDatePipe, AlertComponent ]
})
export class VideoAlertComponent {
  readonly user = input<AuthUser>(undefined)
  readonly video = input<VideoDetails>(undefined)
  readonly noPlaylistVideoFound = input<boolean>(undefined)

  private readonly videoStateMessage = inject(VideoStateMessageService)

  canSeeMoreStateInfo () {
    return !!(this.user()?.hasRight(UserRight.UPDATE_ANY_VIDEO))
  }

  getAlertWarning () {
    const video = this.video()
    if (!video) return undefined

    return this.videoStateMessage.buildWarn({ videoId: video.id, state: video.state.id })
  }

  getAlertError () {
    const video = this.video()
    if (!video) return undefined

    return this.videoStateMessage.buildErr({
      videoId: video.id,
      blacklisted: video.blacklisted,
      blacklistedReason: video.blacklistedReason
    })
  }

  hasVideoScheduledPublication () {
    return this.video()?.scheduledUpdate !== undefined
  }

  isWaitingForLive () {
    return this.video()?.state.id === VideoState.WAITING_FOR_LIVE
  }

  isLiveEnded () {
    return this.video()?.state.id === VideoState.LIVE_ENDED
  }

  isVideoPasswordProtected () {
    return this.video()?.privacy.id === VideoPrivacy.PASSWORD_PROTECTED
  }

  scheduledLiveDate () {
    const liveSchedules = this.video()?.liveSchedules
    if (!liveSchedules || liveSchedules.length === 0) return undefined

    return liveSchedules[0].startAt
  }
}
