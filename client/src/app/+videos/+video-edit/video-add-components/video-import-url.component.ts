import { map, switchMap, takeUntil } from 'rxjs/operators'
import { Subject } from 'rxjs'
import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService, CanComponentDeactivate, ConfirmService, Notifier, ServerService } from '@app/core'
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
export class VideoImportUrlComponent extends VideoSend implements OnDestroy, OnInit, CanComponentDeactivate {
  @Output() firstStepDone = new EventEmitter<string>()
  @Output() firstStepError = new EventEmitter<void>()
  protected ngUnsubscribe: Subject<void> = new Subject<void>()

  targetUrl = ''

  isImportingVideo = false
  hasImportedVideo = false
  isUpdatingVideo = false
  isCanceling = false
  hasCanceledVideo = false

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
    private confirmService: ConfirmService,
    private videoImportService: VideoImportService
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

  ngOnDestroy () {
    this.ngUnsubscribe.next()
    this.ngUnsubscribe.complete()
    return this.ngUnsubscribe.asObservable()
  }

  async cancelImport () {
    const res = await this.confirmService.confirm(
      $localize`Do you really want to cancel the importation ?`,
      $localize`Cancel`
    )
    if (res === false) {
      this.isCanceling = false
      return
    }
    if (this.hasImportedVideo === false) {
      this.isCanceling = true
      this.loadingBar.useRef().complete()
      this.notifier.info($localize`Video to import is being canceled`)
    }
  }

  removeVideo(videoId: number) {
    this.videoService.removeVideo(videoId)
    .subscribe(
      () => {
        this.isImportingVideo = false
        this.hasCanceledVideo = true

        this.loadingBar.useRef().complete()
        this.notifier.success($localize`Video to import canceled`)
      },
      error => {
        this.notifier.error(error.message)
      }
    )
  }

  importVideo () {
    this.isImportingVideo = true
    this.isCanceling = false
    this.hasCanceledVideo = false

    const videoUpdate: VideoUpdate = {
      privacy: VideoPrivacy.PRIVATE,
      waitTranscoding: false,
      commentsEnabled: true,
      downloadEnabled: true,
      channelId: this.firstStepChannelId
    }

    this.loadingBar.useRef().start()

    this.videoImportService
        .importVideoUrl(this.targetUrl, videoUpdate)
        .pipe(
          takeUntil(this.ngOnDestroy()),
          switchMap(res => {
            if (this.isCanceling === true) {
              this.removeVideo(res.video.id)
              return
            }
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
