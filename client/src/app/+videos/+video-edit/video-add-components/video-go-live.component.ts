
import { forkJoin } from 'rxjs'
import { Component, EventEmitter, OnInit, Output } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService, CanComponentDeactivate, Notifier, ServerService } from '@app/core'
import { scrollToTop } from '@app/helpers'
import { FormValidatorService } from '@app/shared/shared-forms'
import { VideoCaptionService, VideoEdit, VideoService } from '@app/shared/shared-main'
import { LiveVideoService } from '@app/shared/shared-video-live'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { LiveVideo, LiveVideoCreate, LiveVideoUpdate, ServerErrorCode, VideoPrivacy } from '@shared/models'
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

  liveVideo: LiveVideo
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
    private liveVideoService: LiveVideoService,
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
    const name = 'Live'

    const video: LiveVideoCreate = {
      name,
      privacy: VideoPrivacy.PRIVATE,
      nsfw: this.serverConfig.instance.isNSFW,
      waitTranscoding: true,
      commentsEnabled: true,
      downloadEnabled: true,
      channelId: this.firstStepChannelId
    }

    // Go live in private mode, but correctly fill the update form with the first user choice
    const toPatch = Object.assign({}, video, { privacy: this.firstStepPrivacyId })
    this.form.patchValue(toPatch)

    this.liveVideoService.goLive(video).subscribe(
      res => {
        this.videoId = res.video.id
        this.videoUUID = res.video.uuid
        this.isInUpdateForm = true

        this.firstStepDone.emit(name)

        this.fetchVideoLive()
      },

      err => {
        this.firstStepError.emit()

        let message = err.message

        if (err.body?.code === ServerErrorCode.MAX_INSTANCE_LIVES_LIMIT_REACHED) {
          message = $localize`Cannot create live because this instance have too many created lives`
        } else if (err.body?.code) {
          message = $localize`Cannot create live because you created too many lives`
        }

        this.notifier.error(message)
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

    const liveVideoUpdate: LiveVideoUpdate = {
      saveReplay: this.form.value.saveReplay,
      permanentLive: this.form.value.permanentLive
    }

    // Update the video
    forkJoin([
      this.updateVideoAndCaptions(video),

      this.liveVideoService.updateLive(this.videoId, liveVideoUpdate)
    ]).subscribe(
      () => {
        this.notifier.success($localize`Live published.`)

        this.router.navigate(['/videos/watch', video.uuid])
      },

      err => {
        this.error = err.message
        scrollToTop()
        console.error(err)
      }
    )
  }

  getMaxLiveDuration () {
    return this.serverConfig.live.maxDuration / 1000
  }

  isWaitTranscodingEnabled () {
    return this.form.value['saveReplay'] === true
  }

  private fetchVideoLive () {
    this.liveVideoService.getVideoLive(this.videoId)
      .subscribe(
        liveVideo => {
          this.liveVideo = liveVideo
        },

        err => {
          this.firstStepError.emit()
          this.notifier.error(err.message)
        }
      )
  }
}
