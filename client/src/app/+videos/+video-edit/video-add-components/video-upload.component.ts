import { BytesPipe } from 'ngx-pipes'
import { Subscription } from 'rxjs'
import { HttpEventType, HttpResponse } from '@angular/common/http'
import { Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService, CanComponentDeactivate, Notifier, ServerService, UserService } from '@app/core'
import { scrollToTop } from '@app/helpers'
import { FormValidatorService } from '@app/shared/shared-forms'
import { VideoCaptionService, VideoEdit, VideoService } from '@app/shared/shared-main'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { VideoPrivacy } from '@shared/models'
import { VideoSend } from './video-send'

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

  waitTranscodingEnabled = true
  previewfileUpload: File

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
    private userService: UserService,
    private router: Router,
    private i18n: I18n
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
      // FIXME: cannot concatenate strings inside i18n service :/
      text = this.i18n('Your video was uploaded to your account and is private.') + ' ' +
        this.i18n('But associated data (tags, description...) will be lost, are you sure you want to leave this page?')
    } else {
      text = this.i18n('Your video is not uploaded yet, are you sure you want to leave this page?')
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
    if (!videofile) return this.i18n('Upload')

    return this.i18n('Upload {{videofileName}}', { videofileName: videofile.name })
  }

  fileChange () {
    this.uploadFirstStep()
  }

  cancelUpload () {
    if (this.videoUploadObservable !== null) {
      this.videoUploadObservable.unsubscribe()

      this.isUploadingVideo = false
      this.videoUploadPercents = 0
      this.videoUploadObservable = null

      this.firstStepError.emit()

      this.notifier.info(this.i18n('Upload cancelled'))
    }
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

    // Force user to wait transcoding for unsupported video types in web browsers
    if (!videofile.name.endsWith('.mp4') && !videofile.name.endsWith('.webm') && !videofile.name.endsWith('.ogv')) {
      this.waitTranscodingEnabled = false
    }

    const privacy = this.firstStepPrivacyId.toString()
    const nsfw = this.serverConfig.instance.isNSFW
    const waitTranscoding = true
    const commentsEnabled = true
    const downloadEnabled = true
    const channelId = this.firstStepChannelId.toString()

    const formData = new FormData()
    formData.append('name', name)
    // Put the video "private" -> we are waiting the user validation of the second step
    formData.append('privacy', VideoPrivacy.PRIVATE.toString())
    formData.append('nsfw', '' + nsfw)
    formData.append('commentsEnabled', '' + commentsEnabled)
    formData.append('downloadEnabled', '' + downloadEnabled)
    formData.append('waitTranscoding', '' + waitTranscoding)
    formData.append('channelId', '' + channelId)
    formData.append('videofile', videofile)

    if (this.previewfileUpload) {
      formData.append('previewfile', this.previewfileUpload)
      formData.append('thumbnailfile', this.previewfileUpload)
    }

    this.isUploadingVideo = true
    this.firstStepDone.emit(name)

    this.form.patchValue({
      name,
      privacy,
      nsfw,
      channelId,
      previewfile: this.previewfileUpload
    })

    this.videoUploadObservable = this.videoService.uploadVideo(formData).subscribe(
      event => {
        if (event.type === HttpEventType.UploadProgress) {
          this.videoUploadPercents = Math.round(100 * event.loaded / event.total)
        } else if (event instanceof HttpResponse) {
          this.videoUploaded = true

          this.videoUploadedIds = event.body.video

          this.videoUploadObservable = null
        }
      },

      err => {
        // Reset progress
        this.isUploadingVideo = false
        this.videoUploadPercents = 0
        this.videoUploadObservable = null
        this.firstStepError.emit()
        this.notifier.error(err.message)
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

            this.notifier.success(this.i18n('Video published.'))
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
      const msg = this.i18n(
        'Your video quota is exceeded with this video (video size: {{videoSize}}, used: {{videoQuotaUsed}}, quota: {{videoQuota}})',
        {
          videoSize: bytePipes.transform(videofile.size, 0),
          videoQuotaUsed: bytePipes.transform(this.userVideoQuotaUsed, 0),
          videoQuota: bytePipes.transform(videoQuota, 0)
        }
      )
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
      const msg = this.i18n(
        'Your daily video quota is exceeded with this video (video size: {{videoSize}}, used: {{quotaUsedDaily}}, quota: {{quotaDaily}})',
        {
          videoSize: bytePipes.transform(videofile.size, 0),
          quotaUsedDaily: bytePipes.transform(this.userVideoQuotaUsedDaily, 0),
          quotaDaily: bytePipes.transform(videoQuotaDaily, 0)
        }
      )
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
