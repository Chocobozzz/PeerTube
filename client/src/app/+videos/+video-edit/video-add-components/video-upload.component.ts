import { Subscription } from 'rxjs'
import { AfterViewInit, Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core'
import { Router } from '@angular/router'
import { UploadxOptions, UploadState, UploadxService } from 'ngx-uploadx'
import { AuthService, CanComponentDeactivate, HooksService, Notifier, ServerService, UserService } from '@app/core'
import { scrollToTop, uploadErrorHandler } from '@app/helpers'
import { FormValidatorService } from '@app/shared/shared-forms'
import { BytesPipe, VideoCaptionService, VideoEdit, VideoService } from '@app/shared/shared-main'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { HttpStatusCode } from '@shared/core-utils/miscs/http-error-codes'
import { VideoPrivacy } from '@shared/models'
import { VideoSend } from './video-send'
import { environment } from 'src/environments/environment'
import { HttpErrorResponse, HttpEventType, HttpHeaders } from '@angular/common/http'

@Component({
  selector: 'my-video-upload',
  templateUrl: './video-upload.component.html',
  styleUrls: [
    '../shared/video-edit.component.scss',
    './video-upload.component.scss',
    './video-send.scss'
  ]
})
export class VideoUploadComponent extends VideoSend implements OnInit, OnDestroy, AfterViewInit, CanComponentDeactivate {

  protected readonly DEFAULT_VIDEO_PRIVACY = VideoPrivacy.PUBLIC

  @Output() firstStepDone = new EventEmitter<string>()
  @Output() firstStepError = new EventEmitter<void>()
  @ViewChild('videofileInput') videofileInput: ElementRef<HTMLInputElement>

  // So that it can be accessed in the template
  readonly SPECIAL_SCHEDULED_PRIVACY = VideoEdit.SPECIAL_SCHEDULED_PRIVACY

  userVideoQuotaUsed = 0
  userVideoQuotaUsedDaily = 0

  isUploadingAudioFile = false
  isUploadingVideo = false
  isUploadingPreviewFile = false
  isUpdatingVideo = false

  videoUploaded = false
  videoUploadPercents = 0
  videoUploadedIds = {
    id: 0,
    uuid: ''
  }
  formData: FormData

  previewfileUpload: File

  error: string
  enableRetryAfterError: boolean

  options: UploadxOptions = {}

  constructor (
    protected formValidatorService: FormValidatorService,
    protected loadingBar: LoadingBarService,
    protected notifier: Notifier,
    protected authService: AuthService,
    protected serverService: ServerService,
    protected videoService: VideoService,
    protected videoCaptionService: VideoCaptionService,
    private userService: UserService,
    private router: Router,
    private hooks: HooksService,
    private uploadService: UploadxService
    ) {
    super()

    const comp = this

    this.options = {
      endpoint: `${environment.apiUrl}/api/v1/videos/upload`,
      multiple: false,
      token: this.authService.getAccessToken(),
      metadata: {
        waitTranscoding: true,
        commentsEnabled: true,
        downloadEnabled: true,
        get channelId () {
          return comp.firstStepChannelId
        },
        get nsfw () {
          return comp.serverConfig.instance.isNSFW
        },
        privacy: VideoPrivacy.PRIVATE.toString()
      }
    }
  }

  get videoExtensions () {
    return this.serverConfig.video.file.extensions.join(', ')
  }

  onUploadVideoOngoing (state: UploadState) {
    switch (state.status) {
      case 'error':
        this.handleUploadError({
          error: new Error(state.response.error),
          name: 'HttpErrorResponse',
          message: state.response.error,
          ok: false,
          headers: new HttpHeaders(state.responseHeaders),
          status: +state.responseStatus,
          statusText: state.response.error,
          type: HttpEventType.Response,
          url: state.url
        })
        break
      case 'queue':
        this.closeFirstStep(state.name)
        break
      case 'uploading':
        this.videoUploadPercents = state.progress
        break
      case 'paused':
        this.notifier.info($localize`Upload cancelled`)
        break
      case 'complete':
        if (this.isUploadingPreviewFile) {
          this.uploadVideoFile(state.response.filename)
          return
        }

        this.videoUploaded = true
        this.videoUploadPercents = 100

        this.videoUploadedIds = state?.response.video
        break
    }
  }

  ngOnInit () {
    super.ngOnInit()

    this.userService.getMyVideoQuotaUsed()
        .subscribe(data => {
          this.userVideoQuotaUsed = data.videoQuotaUsed
          this.userVideoQuotaUsedDaily = data.videoQuotaUsedDaily
        })

    this.uploadService.events
      .subscribe(
        state => this.onUploadVideoOngoing(state)
      )
  }

  ngAfterViewInit () {
    this.hooks.runAction('action:video-upload.init', 'video-edit')
  }

  ngOnDestroy () {
    this.uploadService.control({ action: 'cancel' })
  }

  canDeactivate () {
    let text = ''

    if (this.videoUploaded === true) {
      // FIXME: cannot concatenate strings using $localize
      text = $localize`Your video was uploaded to your account and is private.` + ' ' +
        $localize`But associated data (tags, description...) will be lost, are you sure you want to leave this page?`
    } else {
      text = $localize`Your video is not uploaded yet, are you sure you want to leave this page?`
    }

    return {
      canDeactivate: !this.isUploadingVideo,
      text
    }
  }

  getVideoFile () {
    return this.videofileInput.nativeElement.files[0]
  }

  getAudioUploadLabel () {
    const videofile = this.getVideoFile()
    if (!videofile) return $localize`Upload`

    return $localize`Upload ${videofile.name}`
  }

  retryUpload () {
    this.enableRetryAfterError = false
    this.error = ''
  }

  cancelUpload () {
    this.uploadService.control({ action: 'cancel' })

    this.isUploadingVideo = false
    this.videoUploadPercents = 0

    this.firstStepError.emit()
    this.enableRetryAfterError = false
    this.error = ''
  }

  uploadAudio () {
    if (this.previewfileUpload) {
      this.isUploadingPreviewFile = true

      this.uploadService.handleFiles(this.previewfileUpload, {
        ...this.options,
        metadata: {
          isAudioBg: true
        }
      })
    } else {
      this.uploadVideoFile()
    }
  }

  setVideoFile (files: FileList) {
    this.videofileInput.nativeElement.files = files
    this.onFileChange({ target: this.videofileInput.nativeElement })
  }

  onFileChange (event: { target: any }) {
    const file = event.target.files[0]

    if (!file) return

    if (!this.checkGlobalUserQuota(file)) return
    if (!this.checkDailyUserQuota(file)) return

    if (this.isAudioFile(file.name)) {
      this.isUploadingAudioFile = true
      return
    } else {
      this.isUploadingVideo = true
    }

    this.uploadService.handleFiles(file, this.options)
  }

  isPublishingButtonDisabled () {
    return !this.form.valid ||
      this.isUpdatingVideo === true ||
      this.videoUploaded !== true ||
      !this.videoUploadedIds.id
  }

  updateSecondStep () {
    if (this.isPublishingButtonDisabled() || !this.checkForm()) {
      return
    }

    const video = new VideoEdit()
    video.patch(this.form.value)
    video.id = this.videoUploadedIds.id
    video.uuid = this.videoUploadedIds.uuid

    this.isUpdatingVideo = true

    this.updateVideoAndCaptions(video)
        .subscribe(
          () => {
            this.isUpdatingVideo = false
            this.isUploadingVideo = false

            this.notifier.success($localize`Video published.`)
            this.router.navigate([ '/videos/watch', video.uuid ])
          },

          err => {
            this.error = err.message
            scrollToTop()
            console.error(err)
          }
        )
  }

  private uploadVideoFile (audioBg?: string) {
    this.uploadService.handleFiles(this.getVideoFile(), {
      ...this.options,
      metadata: {
        ...this.options.metadata,
        audioBg
      }
    })
    this.isUploadingPreviewFile = false
    this.isUploadingVideo = true
  }

  private handleUploadError (err: HttpErrorResponse) {
    // Reset progress (but keep isUploadingVideo true)
    this.videoUploadPercents = 0
    this.enableRetryAfterError = true

    this.error = uploadErrorHandler({
      err,
      name: $localize`video`,
      notifier: this.notifier,
      sticky: false
    })

    if (err.status === HttpStatusCode.UNSUPPORTED_MEDIA_TYPE_415) {
      this.cancelUpload()
    }
  }

  private closeFirstStep (filename: string) {
    const nameWithoutExtension = filename.replace(/\.[^/.]+$/, '')
    const name = nameWithoutExtension.length < 3 ? filename : nameWithoutExtension

    this.form.patchValue({
      name,
      privacy: this.firstStepPrivacyId,
      nsfw: this.serverConfig.instance.isNSFW,
      channelId: this.firstStepChannelId,
      previewfile: this.previewfileUpload
    })

    this.firstStepDone.emit(name)
  }

  private checkGlobalUserQuota (videofile: File) {
    const bytePipes = new BytesPipe()

    // Check global user quota
    const videoQuota = this.authService.getUser().videoQuota
    if (videoQuota !== -1 && (this.userVideoQuotaUsed + videofile.size) > videoQuota) {
      const videoSizeBytes = bytePipes.transform(videofile.size, 0)
      const videoQuotaUsedBytes = bytePipes.transform(this.userVideoQuotaUsed, 0)
      const videoQuotaBytes = bytePipes.transform(videoQuota, 0)

      const msg = $localize`Your video quota is exceeded with this video (
video size: ${videoSizeBytes}, used: ${videoQuotaUsedBytes}, quota: ${videoQuotaBytes})`
      this.notifier.error(msg)

      return false
    }

    return true
  }

  private checkDailyUserQuota (videofile: File) {
    const bytePipes = new BytesPipe()

    // Check daily user quota
    const videoQuotaDaily = this.authService.getUser().videoQuotaDaily
    if (videoQuotaDaily !== -1 && (this.userVideoQuotaUsedDaily + videofile.size) > videoQuotaDaily) {
      const videoSizeBytes = bytePipes.transform(videofile.size, 0)
      const quotaUsedDailyBytes = bytePipes.transform(this.userVideoQuotaUsedDaily, 0)
      const quotaDailyBytes = bytePipes.transform(videoQuotaDaily, 0)

      const msg = $localize`Your daily video quota is exceeded with this video (
video size: ${videoSizeBytes}, used: ${quotaUsedDailyBytes}, quota: ${quotaDailyBytes})`
      this.notifier.error(msg)

      return false
    }

    return true
  }

  private isAudioFile (filename: string) {
    const extensions = [ '.mp3', '.flac', '.ogg', '.wma', '.wav' ]

    return extensions.some(e => filename.endsWith(e))
  }
}
