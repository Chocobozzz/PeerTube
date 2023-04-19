import { forkJoin } from 'rxjs'
import { AfterViewInit, Component, EventEmitter, OnInit, Output } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService, CanComponentDeactivate, HooksService, Notifier, ServerService } from '@app/core'
import { scrollToTop } from '@app/helpers'
import { FormReactiveService } from '@app/shared/shared-forms'
import { Video, VideoCaptionService, VideoEdit, VideoService } from '@app/shared/shared-main'
import { LiveVideoService } from '@app/shared/shared-video-live'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { logger } from '@root-helpers/logger'
import {
  LiveVideo,
  LiveVideoCreate,
  LiveVideoLatencyMode,
  LiveVideoUpdate,
  PeerTubeProblemDocument,
  ServerErrorCode,
  VideoPrivacy
} from '@shared/models'
import { VideoSend } from './video-send'

@Component({
  selector: 'my-video-go-live',
  templateUrl: './video-go-live.component.html',
  styleUrls: [
    '../shared/video-edit.component.scss',
    './video-go-live.component.scss',
    './video-send.scss'
  ]
})
export class VideoGoLiveComponent extends VideoSend implements OnInit, AfterViewInit, CanComponentDeactivate {
  @Output() firstStepDone = new EventEmitter<string>()
  @Output() firstStepError = new EventEmitter<void>()

  firstStepPermanentLive: boolean

  isInUpdateForm = false
  isUpdatingVideo = false
  isOrHasGoingLive = false

  liveVideo: LiveVideo

  videoId: number
  videoUUID: string
  videoShortUUID: string

  error: string

  constructor (
    protected formReactiveService: FormReactiveService,
    protected loadingBar: LoadingBarService,
    protected notifier: Notifier,
    protected authService: AuthService,
    protected serverService: ServerService,
    protected videoService: VideoService,
    protected videoCaptionService: VideoCaptionService,
    private liveVideoService: LiveVideoService,
    private router: Router,
    private hooks: HooksService
  ) {
    super()
  }

  ngOnInit () {
    super.ngOnInit()
  }

  ngAfterViewInit () {
    this.hooks.runAction('action:go-live.init', 'video-edit')
  }

  canDeactivate () {
    return { canDeactivate: true }
  }

  goLive () {
    if (this.isOrHasGoingLive) return
    this.isOrHasGoingLive = true

    const name = 'Live'

    const video: LiveVideoCreate = {
      name,
      privacy: this.highestPrivacy,
      nsfw: this.serverConfig.instance.isNSFW,
      waitTranscoding: true,
      permanentLive: this.firstStepPermanentLive,
      latencyMode: LiveVideoLatencyMode.DEFAULT,
      saveReplay: this.isReplayAllowed(),
      replaySettings: { privacy: VideoPrivacy.PRIVATE },
      channelId: this.firstStepChannelId
    }

    // Go live in private mode, but correctly fill the update form with the first user choice
    const toPatch = { ...video, privacy: this.firstStepPrivacyId, replayPrivacy: video.replaySettings.privacy }
    this.form.patchValue(toPatch)

    this.liveVideoService.goLive(video)
      .subscribe({
        next: res => {
          this.videoId = res.video.id
          this.videoUUID = res.video.uuid
          this.videoShortUUID = res.video.shortUUID
          this.isInUpdateForm = true

          this.firstStepDone.emit(name)

          this.fetchVideoLive()
        },

        error: err => {
          this.firstStepError.emit()

          let message = err.message

          const error = err.body as PeerTubeProblemDocument

          if (error?.code === ServerErrorCode.MAX_INSTANCE_LIVES_LIMIT_REACHED) {
            message = $localize`Cannot create live because this instance have too many created lives`
          } else if (error?.code === ServerErrorCode.MAX_USER_LIVES_LIMIT_REACHED) {
            message = $localize`Cannot create live because you created too many lives`
          }

          this.notifier.error(message)
        }
      })
  }

  async updateSecondStep () {
    if (!await this.isFormValid()) return

    this.isUpdatingVideo = true

    const video = new VideoEdit()
    video.patch(this.form.value)
    video.id = this.videoId
    video.uuid = this.videoUUID
    video.shortUUID = this.videoShortUUID

    const saveReplay = this.form.value.saveReplay
    const replaySettings = saveReplay
      ? { privacy: this.form.value.replayPrivacy }
      : undefined

    const liveVideoUpdate: LiveVideoUpdate = {
      saveReplay,
      replaySettings,
      latencyMode: this.form.value.latencyMode,
      permanentLive: this.form.value.permanentLive
    }

    // Update the video
    forkJoin([
      this.updateVideoAndCaptions(video),

      this.liveVideoService.updateLive(this.videoId, liveVideoUpdate)
    ]).subscribe({
      next: () => {
        this.isUpdatingVideo = false

        this.notifier.success($localize`Live published.`)

        this.router.navigateByUrl(Video.buildWatchUrl(video))
      },

      error: err => {
        this.error = err.message
        scrollToTop()
        logger.error(err)
      }
    })
  }

  getMaxLiveDuration () {
    return this.serverConfig.live.maxDuration / 1000
  }

  getNormalLiveDescription () {
    if (this.isReplayAllowed()) {
      return $localize`Stream only once, replay will replace your live`
    }

    return $localize`Stream only once`
  }

  getPermanentLiveDescription () {
    if (this.isReplayAllowed()) {
      return $localize`Stream multiple times, replays will be separate videos`
    }

    return $localize`Stream multiple times using the same URL`
  }

  private isReplayAllowed () {
    return this.serverConfig.live.allowReplay
  }

  private fetchVideoLive () {
    this.liveVideoService.getVideoLive(this.videoId)
      .subscribe({
        next: liveVideo => {
          this.liveVideo = liveVideo
        },

        error: err => {
          this.firstStepError.emit()
          this.notifier.error(err.message)
        }
      })
  }
}
