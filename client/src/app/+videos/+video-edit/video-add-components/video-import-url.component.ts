import { map, switchMap } from 'rxjs/operators'
import { Component, EventEmitter, OnInit, Output } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService, CanComponentDeactivate, Notifier, ServerService } from '@app/core'
import { getAbsoluteAPIUrl, scrollToTop } from '@app/helpers'
import { FormValidatorService } from '@app/shared/shared-forms'
import { VideoCaptionService, VideoEdit, VideoImportService, VideoService } from '@app/shared/shared-main'
import { VideoSend } from './video-send'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { VideoPrivacy, VideoUpdate } from '@shared/models'

@Component({
  selector: 'my-video-import-url',
  templateUrl: './video-import-url.component.html',
  styleUrls: [
    '../shared/video-edit.component.scss',
    './video-send.scss'
  ]
})
export class VideoImportUrlComponent extends VideoSend implements OnInit, CanComponentDeactivate {
  @Output() firstStepDone = new EventEmitter<string>()
  @Output() firstStepError = new EventEmitter<void>()

  targetUrl = ''

  isImportingVideo = false
  hasImportedVideo = false
  isUpdatingVideo = false

  video: VideoEdit
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
    private router: Router,
    private videoImportService: VideoImportService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    super.ngOnInit()
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
      privacy: this.firstStepPrivacyId,
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
              support: null,
              thumbnailUrl,
              previewUrl
            }))

            this.videoCaptions = videoCaptions

            this.hydrateFormFromVideo()
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
            this.notifier.success(this.i18n('Video to import updated.'))

            this.router.navigate([ '/my-account', 'video-imports' ])
          },

          err => {
            this.error = err.message
            scrollToTop()
            console.error(err)
          }
        )

  }

  private hydrateFormFromVideo () {
    this.form.patchValue(this.video.toFormPatch())

    const objects = [
      {
        url: 'thumbnailUrl',
        name: 'thumbnailfile'
      },
      {
        url: 'previewUrl',
        name: 'previewfile'
      }
    ]

    for (const obj of objects) {
      fetch(this.video[obj.url])
        .then(response => response.blob())
        .then(data => {
          this.form.patchValue({
            [ obj.name ]: data
          })
        })
    }
  }
}
