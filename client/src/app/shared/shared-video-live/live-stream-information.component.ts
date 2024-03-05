import { Component, ElementRef, ViewChild } from '@angular/core'
import { Video } from '@app/shared/shared-main/video/video.model'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { LiveVideo, LiveVideoError, LiveVideoErrorType, LiveVideoSession } from '@peertube/peertube-models'
import { LiveVideoService } from './live-video.service'
import { EditButtonComponent } from '../shared-main/buttons/edit-button.component'
import { RouterLink } from '@angular/router'
import { InputTextComponent } from '../shared-forms/input-text.component'
import { LiveDocumentationLinkComponent } from './live-documentation-link.component'
import { NgIf, NgFor, DatePipe } from '@angular/common'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'

@Component({
  selector: 'my-live-stream-information',
  templateUrl: './live-stream-information.component.html',
  styleUrls: [ './live-stream-information.component.scss' ],
  standalone: true,
  imports: [
    GlobalIconComponent,
    NgIf,
    LiveDocumentationLinkComponent,
    InputTextComponent,
    NgFor,
    RouterLink,
    EditButtonComponent,
    DatePipe
  ],
  providers: [ LiveVideoService ]
})
export class LiveStreamInformationComponent {
  @ViewChild('modal', { static: true }) modal: ElementRef

  video: Video
  live: LiveVideo
  latestLiveSessions: LiveVideoSession[] = []

  constructor (
    private modalService: NgbModal,
    private liveVideoService: LiveVideoService
  ) { }

  show (video: Video) {
    this.video = video
    this.live = undefined

    this.loadLiveInfo(video)

    this.modalService
      .open(this.modal, { centered: true })
  }

  getVideoUrl (video: { shortUUID: string }) {
    return Video.buildWatchUrl(video)
  }

  getErrorLabel (session: LiveVideoSession) {
    if (!session.error) return undefined

    const errors: { [ id in LiveVideoErrorType ]: string } = {
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

  private loadLiveInfo (video: Video) {
    this.liveVideoService.getVideoLive(video.id)
      .subscribe(live => this.live = live)

    this.liveVideoService.listSessions(video.id)
      .subscribe(({ data }) => this.latestLiveSessions = data.reverse().slice(0, 5))
  }
}
