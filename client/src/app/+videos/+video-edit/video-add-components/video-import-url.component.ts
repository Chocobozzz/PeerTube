import { forkJoin } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'
import { AfterViewInit, Component, EventEmitter, OnInit, Output } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService, CanComponentDeactivate, HooksService, Notifier, ServerService } from '@app/core'
import { scrollToTop } from '@app/helpers'
import { FormReactiveService } from '@app/shared/shared-forms'
import { VideoCaptionService, VideoEdit, VideoImportService, VideoService } from '@app/shared/shared-main'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { logger } from '@root-helpers/logger'
import { VideoUpdate } from '@peertube/peertube-models'
import { hydrateFormFromVideo } from '../shared/video-edit-utils'
import { VideoSend } from './video-send'

@Component({
  selector: 'my-video-import-url',
  templateUrl: './video-import-url.component.html',
  styleUrls: [
    '../shared/video-edit.component.scss',
    './video-send.scss'
  ]
})
export class VideoImportUrlComponent extends VideoSend implements OnInit, AfterViewInit, CanComponentDeactivate {
  @Output() firstStepDone = new EventEmitter<string>()
  @Output() firstStepError = new EventEmitter<void>()

  targetUrl = ''

  isImportingVideo = false
  hasImportedVideo = false
  isUpdatingVideo = false

  video: VideoEdit
  error: string

  constructor (
    protected formReactiveService: FormReactiveService,
    protected loadingBar: LoadingBarService,
    protected notifier: Notifier,
    protected authService: AuthService,
    protected serverService: ServerService,
    protected videoService: VideoService,
    protected videoCaptionService: VideoCaptionService,
    private router: Router,
    private videoImportService: VideoImportService,
    private hooks: HooksService
  ) {
    super()
  }

  ngOnInit () {
    super.ngOnInit()
  }

  ngAfterViewInit () {
    this.hooks.runAction('action:video-url-import.init', 'video-edit')
  }

  canDeactivate () {
    return { canDeactivate: true }
  }

  isTargetUrlValid () {
    return this.targetUrl?.match(/https?:\/\//)
  }

  isChannelSyncEnabled () {
    return this.serverConfig.import.videoChannelSynchronization.enabled
  }

  importVideo () {
    this.isImportingVideo = true

    const videoUpdate: VideoUpdate = {
      privacy: this.highestPrivacy,
      waitTranscoding: false,
      channelId: this.firstStepChannelId
    }

    this.loadingBar.useRef().start()

    this.videoImportService
        .importVideoUrl(this.targetUrl, videoUpdate)
        .pipe(
          switchMap(previous => {
            return forkJoin([
              this.videoCaptionService.listCaptions(previous.video.uuid),
              this.videoService.getVideo({ videoId: previous.video.uuid })
            ]).pipe(map(([ videoCaptionsResult, video ]) => ({ videoCaptions: videoCaptionsResult.data, video })))
          })
        )
        .subscribe({
          next: ({ video, videoCaptions }) => {
            this.loadingBar.useRef().complete()
            this.firstStepDone.emit(video.name)
            this.isImportingVideo = false
            this.hasImportedVideo = true

            this.video = new VideoEdit(video)
            this.video.patch({ privacy: this.firstStepPrivacyId })

            this.videoCaptions = videoCaptions

            hydrateFormFromVideo(this.form, this.video, true)
          },

          error: err => {
            this.loadingBar.useRef().complete()
            this.isImportingVideo = false
            this.firstStepError.emit()
            this.notifier.error(err.message)
          }
        })
  }

  async updateSecondStep () {
    if (!await this.isFormValid()) return

    this.video.patch(this.form.value)

    this.isUpdatingVideo = true

    // Update the video
    this.updateVideoAndCaptions(this.video)
        .subscribe({
          next: () => {
            this.isUpdatingVideo = false
            this.notifier.success($localize`Video to import updated.`)

            this.router.navigate([ '/my-library', 'video-imports' ])
          },

          error: err => {
            this.error = err.message
            scrollToTop()
            logger.error(err)
          }
        })
  }
}
