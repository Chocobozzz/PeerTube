
import { Component, EventEmitter, OnInit, Output } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService, CanComponentDeactivate, Notifier, ServerService } from '@app/core'
import { scrollToTop } from '@app/helpers'
import { FormValidatorService } from '@app/shared/shared-forms'
import { VideoCaptionService, VideoEdit, VideoService, VideoLiveService } from '@app/shared/shared-main'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { VideoCreate, VideoLive, VideoPrivacy } from '@shared/models'
import { VideoSend } from './video-send'

@Component({
  selector: 'my-video-go-live',
  templateUrl: './video-go-live.component.html',
  styleUrls: [
    '../shared/video-edit.component.scss',
    './video-send.scss'
  ]
})
export class VideoGoLiveComponent extends VideoSend implements OnInit, CanComponentDeactivate {
  @Output() firstStepDone = new EventEmitter<string>()
  @Output() firstStepError = new EventEmitter<void>()

  isInUpdateForm = false

  videoLive: VideoLive
  videoId: number
  videoUUID: string
  error: string

  protected readonly DEFAULT_VIDEO_PRIVACY = VideoPrivacy.PUBLIC

  constructor (
    protected formValidatorService: FormValidatorService,
    protected loadingBar: LoadingBarService,
    protected notifier: Notifier,
    protected authService: AuthService,
    protected serverService: ServerService,
    protected videoService: VideoService,
    protected videoCaptionService: VideoCaptionService,
    private videoLiveService: VideoLiveService,
    private router: Router
    ) {
    super()
  }

  ngOnInit () {
    super.ngOnInit()
  }

  canDeactivate () {
    return { canDeactivate: true }
  }

  goLive () {
    const video: VideoCreate = {
      name: 'Live',
      privacy: VideoPrivacy.PRIVATE,
      nsfw: this.serverConfig.instance.isNSFW,
      waitTranscoding: true,
      commentsEnabled: true,
      downloadEnabled: true,
      channelId: this.firstStepChannelId
    }

    this.firstStepDone.emit(name)

    // Go live in private mode, but correctly fill the update form with the first user choice
    const toPatch = Object.assign({}, video, { privacy: this.firstStepPrivacyId })
    this.form.patchValue(toPatch)

    this.videoLiveService.goLive(video).subscribe(
      res => {
        this.videoId = res.video.id
        this.videoUUID = res.video.uuid
        this.isInUpdateForm = true

        this.fetchVideoLive()
      },

      err => {
        this.firstStepError.emit()
        this.notifier.error(err.message)
      }
    )
  }

  updateSecondStep () {
    if (this.checkForm() === false) {
      return
    }

    const video = new VideoEdit()
    video.patch(this.form.value)
    video.id = this.videoId
    video.uuid = this.videoUUID

    // Update the video
    this.updateVideoAndCaptions(video)
        .subscribe(
          () => {
            this.notifier.success($localize`Live published.`)

            this.router.navigate([ '/videos/watch', video.uuid ])
          },

          err => {
            this.error = err.message
            scrollToTop()
            console.error(err)
          }
        )

  }

  private fetchVideoLive () {
    this.videoLiveService.getVideoLive(this.videoId)
      .subscribe(
        videoLive => {
          this.videoLive = videoLive
        },

        err => {
          this.firstStepError.emit()
          this.notifier.error(err.message)
        }
      )
  }
}
