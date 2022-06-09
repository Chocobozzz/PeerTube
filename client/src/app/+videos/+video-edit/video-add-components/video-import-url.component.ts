import { map, switchMap } from 'rxjs/operators'
import { AfterViewInit, Component, EventEmitter, OnInit, Output } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService, CanComponentDeactivate, HooksService, Notifier, ServerService } from '@app/core'
import { getAbsoluteAPIUrl, scrollToTop } from '@app/helpers'
import { FormValidatorService } from '@app/shared/shared-forms'
import { VideoCaptionService, VideoEdit, VideoImportService, VideoService } from '@app/shared/shared-main'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { VideoPrivacy, VideoUpdate } from '@shared/models'
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
    protected formValidatorService: FormValidatorService,
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
    return this.targetUrl && this.targetUrl.match(/https?:\/\//)
  }

  importVideo () {
    this.isImportingVideo = true

    const videoUpdate: VideoUpdate = {
      privacy: this.highestPrivacy,
      waitTranscoding: false,
      commentsEnabled: true,
      downloadEnabled: true,
      channelId: this.firstStepChannelId
    }

    this.loadingBar.useRef().start()

    this.videoImportService
        .importVideoUrl(this.targetUrl, videoUpdate)
        .pipe(
          switchMap(res => {
            return this.videoCaptionService
                .listCaptions(res.video.id)
                .pipe(
                  map(result => ({ video: res.video, videoCaptions: result.data }))
                )
          })
        )
        .subscribe(
          ({ video, videoCaptions }) => {
            this.loadingBar.useRef().complete()
            this.firstStepDone.emit(video.name)
            this.isImportingVideo = false
            this.hasImportedVideo = true

            const absoluteAPIUrl = getAbsoluteAPIUrl()

            const thumbnailUrl = video.thumbnailPath
              ? absoluteAPIUrl + video.thumbnailPath
              : null

            const previewUrl = video.previewPath
              ? absoluteAPIUrl + video.previewPath
              : null

            this.video = new VideoEdit(Object.assign(video, {
              commentsEnabled: videoUpdate.commentsEnabled,
              downloadEnabled: videoUpdate.downloadEnabled,
              privacy: { id: this.firstStepPrivacyId },
              support: null,
              thumbnailUrl,
              previewUrl
            }))

            this.videoCaptions = videoCaptions

            hydrateFormFromVideo(this.form, this.video, true)
          },

          err => {
            this.loadingBar.useRef().complete()
            this.isImportingVideo = false
            this.firstStepError.emit()
            this.notifier.error(err.message)
          }
        )
  }

  updateSecondStep () {
    if (this.checkForm() === false) {
      return
    }

    this.video.patch(this.form.value)

    this.isUpdatingVideo = true

    // Update the video
    this.updateVideoAndCaptions(this.video)
        .subscribe(
          () => {
            this.isUpdatingVideo = false
            this.notifier.success($localize`Video to import updated.`)

            this.router.navigate([ '/my-library', 'video-imports' ])
          },

          err => {
            this.error = err.message
            scrollToTop()
            console.error(err)
          }
        )
  }
}
