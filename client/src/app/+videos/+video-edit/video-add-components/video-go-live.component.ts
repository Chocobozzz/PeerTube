import { NgIf } from '@angular/common'
import { AfterViewInit, Component, EventEmitter, OnInit, Output } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { AuthService, CanComponentDeactivate, HooksService, Notifier, ServerService } from '@app/core'
import { scrollToTop } from '@app/helpers'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { VideoCaptionService } from '@app/shared/shared-main/video-caption/video-caption.service'
import { VideoChapterService } from '@app/shared/shared-main/video/video-chapter.service'
import { VideoEdit } from '@app/shared/shared-main/video/video-edit.model'
import { Video } from '@app/shared/shared-main/video/video.model'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { LiveVideoService } from '@app/shared/shared-video-live/live-video.service'
import { LoadingBarService } from '@ngx-loading-bar/core'
import {
  LiveVideo,
  LiveVideoCreate,
  LiveVideoLatencyMode,
  LiveVideoUpdate,
  PeerTubeProblemDocument,
  ServerErrorCode,
  VideoPrivacy
} from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { forkJoin } from 'rxjs'
import { SelectChannelComponent } from '../../../shared/shared-forms/select/select-channel.component'
import { SelectOptionsComponent } from '../../../shared/shared-forms/select/select-options.component'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { TimeDurationFormatterPipe } from '../../../shared/shared-main/date/time-duration-formatter.pipe'
import { VideoEditComponent } from '../shared/video-edit.component'
import { VideoSend } from './video-send'

@Component({
  selector: 'my-video-go-live',
  templateUrl: './video-go-live.component.html',
  styleUrls: [
    '../shared/video-edit.component.scss',
    './video-go-live.component.scss',
    './video-send.scss'
  ],
  imports: [
    NgIf,
    GlobalIconComponent,
    SelectChannelComponent,
    FormsModule,
    SelectOptionsComponent,
    ReactiveFormsModule,
    VideoEditComponent,
    ButtonComponent,
    TimeDurationFormatterPipe,
    AlertComponent
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
    protected videoChapterService: VideoChapterService,
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

      // Password privacy needs a password that will be set in the next step
      privacy: this.firstStepPrivacyId === VideoPrivacy.PASSWORD_PROTECTED
        ? VideoPrivacy.PRIVATE
        : this.highestPrivacy,

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

    this.chaptersEdit.patch(this.form.value)

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
      this.updateVideoAndCaptionsAndChapters({ video, captions: this.videoCaptions }),

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
