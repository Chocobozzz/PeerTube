import { Subscription } from 'rxjs'
import { HttpErrorResponse, HttpEventType, HttpResponse } from '@angular/common/http'
import { Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService, CanComponentDeactivate, Notifier, ServerService, UserService } from '@app/core'
import { scrollToTop, uploadErrorHandler } from '@app/helpers'
import { FormValidatorService } from '@app/shared/shared-forms'
import { BytesPipe, VideoCaptionService, VideoEdit, VideoService } from '@app/shared/shared-main'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { VideoPrivacy } from '@shared/models'
import { VideoSend } from './video-send'
import { HttpStatusCode } from '@shared/core-utils/miscs/http-error-codes'

@Component({
  selector: 'my-video-upload',
  templateUrl: './video-upload.component.html',
  styleUrls: [
    '../shared/video-edit.component.scss',
    './video-upload.component.scss',
    './video-send.scss'
  ]
})
export class VideoUploadComponent extends VideoSend implements OnInit, OnDestroy, CanComponentDeactivate {
  @Output() firstStepDone = new EventEmitter<string>()
  @Output() firstStepError = new EventEmitter<void>()
  @ViewChild('videofileInput') videofileInput: ElementRef<HTMLInputElement>

  // So that it can be accessed in the template
  readonly SPECIAL_SCHEDULED_PRIVACY = VideoEdit.SPECIAL_SCHEDULED_PRIVACY

  userVideoQuotaUsed = 0
  userVideoQuotaUsedDaily = 0

  isUploadingAudioFile = false
  isUploadingVideo = false
  isUpdatingVideo = false

  videoUploaded = false
  videoUploadObservable: Subscription = null
  videoUploadPercents = 0
  videoUploadedIds = {
    id: 0,
    uuid: ''
  }
  formData: FormData

  previewfileUpload: File

  error: string
  enableRetryAfterError: boolean

  protected readonly DEFAULT_VIDEO_PRIVACY = VideoPrivacy.PUBLIC

  constructor (
    protected formValidatorService: FormValidatorService,
    protected loadingBar: LoadingBarService,
    protected notifier: Notifier,
    protected authService: AuthService,
    protected serverService: ServerService,
    protected videoService: VideoService,
    protected videoCaptionService: VideoCaptionService,
    private userService: UserService,
    private router: Router
    ) {
    super()
  }

  get videoExtensions () {
    return this.serverConfig.video.file.extensions.join(', ')
  }

  ngOnInit () {
    super.ngOnInit()

    this.userService.getMyVideoQuotaUsed()
        .subscribe(data => {
          this.userVideoQuotaUsed = data.videoQuotaUsed
          this.userVideoQuotaUsedDaily = data.videoQuotaUsedDaily
        })
  }

  ngOnDestroy () {
    if (this.videoUploadObservable) this.videoUploadObservable.unsubscribe()
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

  setVideoFile (files: FileList) {
    this.videofileInput.nativeElement.files = files
    this.fileChange()
  }

  getAudioUploadLabel () {
    const videofile = this.getVideoFile()
    if (!videofile) return $localize`Upload`

    return $localize`Upload ${videofile.name}`
  }

  fileChange () {
    this.uploadFirstStep()
  }

  retryUpload () {
    this.enableRetryAfterError = false
    this.error = ''
    this.uploadVideo()
  }

  cancelUpload () {
    if (this.videoUploadObservable !== null) {
      this.videoUploadObservable.unsubscribe()
    }

    this.isUploadingVideo = false
    this.videoUploadPercents = 0
    this.videoUploadObservable = null

    this.firstStepError.emit()
    this.enableRetryAfterError = false
    this.error = ''

    this.notifier.info($localize`Upload cancelled`)
  }

  uploadFirstStep (clickedOnButton = false) {
    const videofile = this.getVideoFile()
    if (!videofile) return

    if (!this.checkGlobalUserQuota(videofile)) return
    if (!this.checkDailyUserQuota(videofile)) return

    if (clickedOnButton === false && this.isAudioFile(videofile.name)) {
      this.isUploadingAudioFile = true
      return
    }

    // Build name field
    const nameWithoutExtension = videofile.name.replace(/\.[^/.]+$/, '')
    let name: string

    // If the name of the file is very small, keep the extension
    if (nameWithoutExtension.length < 3) name = videofile.name
    else name = nameWithoutExtension

    const nsfw = this.serverConfig.instance.isNSFW
    const waitTranscoding = true
    const commentsEnabled = true
    const downloadEnabled = true
    const channelId = this.firstStepChannelId.toString()

    this.formData = new FormData()
    this.formData.append('name', name)
    // Put the video "private" -> we are waiting the user validation of the second step
    this.formData.append('privacy', VideoPrivacy.PRIVATE.toString())
    this.formData.append('nsfw', '' + nsfw)
    this.formData.append('commentsEnabled', '' + commentsEnabled)
    this.formData.append('downloadEnabled', '' + downloadEnabled)
    this.formData.append('waitTranscoding', '' + waitTranscoding)
    this.formData.append('channelId', '' + channelId)
    this.formData.append('videofile', videofile)

    if (this.previewfileUpload) {
      this.formData.append('previewfile', this.previewfileUpload)
      this.formData.append('thumbnailfile', this.previewfileUpload)
    }

    this.isUploadingVideo = true
    this.firstStepDone.emit(name)

    this.form.patchValue({
      name,
      privacy: this.firstStepPrivacyId,
      nsfw,
      channelId: this.firstStepChannelId,
      previewfile: this.previewfileUpload
    })

    this.uploadVideo()
  }

  uploadVideo () {
    this.videoUploadObservable = this.videoService.uploadVideo(this.formData).subscribe(
      event => {
        if (event.type === HttpEventType.UploadProgress) {
          this.videoUploadPercents = Math.round(100 * event.loaded / event.total)
        } else if (event instanceof HttpResponse) {
          this.videoUploaded = true

          this.videoUploadedIds = event.body.video

          this.videoUploadObservable = null
        }
      },

      (err: HttpErrorResponse) => {
        // Reset progress (but keep isUploadingVideo true)
        this.videoUploadPercents = 0
        this.videoUploadObservable = null
        this.enableRetryAfterError = true

        this.error = uploadErrorHandler({
          err,
          name: $localize`video`,
          notifier: this.notifier,
          sticky: false
        })

        if (err.status === HttpStatusCode.PAYLOAD_TOO_LARGE_413 ||
            err.status === HttpStatusCode.UNSUPPORTED_MEDIA_TYPE_415) {
          this.cancelUpload()
        }
      }
    )
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
