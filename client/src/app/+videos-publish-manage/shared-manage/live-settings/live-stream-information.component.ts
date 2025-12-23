import { Component, inject, input, OnInit } from '@angular/core'
import { RouterLink } from '@angular/router'
import { Video } from '@app/shared/shared-main/video/video.model'
import { LiveVideoError, LiveVideoErrorType, LiveVideoSession } from '@peertube/peertube-models'
import { PTDatePipe } from '../../../shared/shared-main/common/date.pipe'
import { LiveVideoService } from '../../../shared/shared-video-live/live-video.service'

@Component({
  selector: 'my-live-stream-information',
  templateUrl: './live-stream-information.component.html',
  styleUrls: [ './live-stream-information.component.scss' ],
  imports: [
    RouterLink,
    PTDatePipe
  ],
  providers: [ LiveVideoService ]
})
export class LiveStreamInformationComponent implements OnInit {
  private liveVideoService = inject(LiveVideoService)

  video = input.required<Pick<Video, 'id' | 'shortUUID'>>()
  latestLiveSessions: LiveVideoSession[] = []

  ngOnInit () {
    this.liveVideoService.listSessions(this.video().id)
      .subscribe(({ data }) => this.latestLiveSessions = data)
  }

  getVideoUrl (video: { shortUUID: string }) {
    return Video.buildWatchUrl(video)
  }

  getErrorLabel (session: LiveVideoSession) {
    if (!session.error) return undefined

    const errors: { [id in LiveVideoErrorType]: string } = {
      [LiveVideoError.BAD_SOCKET_HEALTH]: $localize`Server too slow`,
      [LiveVideoError.BLACKLISTED]: $localize`Live blacklisted`,
      [LiveVideoError.DURATION_EXCEEDED]: $localize`Max duration exceeded`,
      [LiveVideoError.FFMPEG_ERROR]: $localize`Server error`,
      [LiveVideoError.QUOTA_EXCEEDED]: $localize`Quota exceeded`,
      [LiveVideoError.RUNNER_JOB_CANCEL]: $localize`Runner job cancelled`,
      [LiveVideoError.RUNNER_JOB_ERROR]: $localize`Error in runner job`,
      [LiveVideoError.UNKNOWN_ERROR]: $localize`Unknown error`,
      [LiveVideoError.INVALID_INPUT_VIDEO_STREAM]: $localize`Invalid input video stream`
    }

    return errors[session.error]
  }

  isReplayBeingProcessed (session: LiveVideoSession) {
    // Running live
    if (!session.endDate) return false

    return session.saveReplay && !session.endingProcessed
  }
}
