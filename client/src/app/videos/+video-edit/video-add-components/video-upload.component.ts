import { HttpEventType, HttpResponse } from '@angular/common/http'
import { Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core'
import { Router } from '@angular/router'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { BytesPipe } from 'ngx-pipes'
import { Subscription } from 'rxjs'
import { VideoPrivacy } from '../../../../../../shared/models/videos'
import { AuthService, Notifier, ServerService } from '../../../core'
import { VideoEdit } from '../../../shared/video/video-edit.model'
import { VideoService } from '../../../shared/video/video.service'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { VideoSend } from '@app/videos/+video-edit/video-add-components/video-send'
import { CanComponentDeactivate } from '@app/shared/guards/can-deactivate-guard.service'
import { FormValidatorService, UserService } from '@app/shared'
import { VideoCaptionService } from '@app/shared/video-caption'
import { scrollToTop } from '@app/shared/misc/utils'

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
    return this.serverService.getConfig().video.file.extensions.join(',')
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

  fileChange () {
    this.uploadFirstStep()
  }

  cancelUpload () {
    if (this.videoUploadObservable !== null) {
      this.videoUploadObservable.unsubscribe()
      this.isUploadingVideo = false
      this.videoUploadPercents = 0
      this.videoUploadObservable = null
      this.notifier.info(this.i18n('Upload cancelled'))
    }
  }

  uploadFirstStep () {
    const videofile = this.videofileInput.nativeElement.files[0]
    if (!videofile) return

    // Check global user quota
    const bytePipes = new BytesPipe()
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
      return
    }

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
    const nsfw = false
    const waitTranscoding = true
    const commentsEnabled = true
    const channelId = this.firstStepChannelId.toString()

    const formData = new FormData()
    formData.append('name', name)
    // Put the video "private" -> we are waiting the user validation of the second step
    formData.append('privacy', VideoPrivacy.PRIVATE.toString())
    formData.append('nsfw', '' + nsfw)
    formData.append('commentsEnabled', '' + commentsEnabled)
    formData.append('waitTranscoding', '' + waitTranscoding)
    formData.append('channelId', '' + channelId)
    formData.append('videofile', videofile)

    this.isUploadingVideo = true
    this.firstStepDone.emit(name)

    this.form.patchValue({
      name,
      privacy,
      nsfw,
      channelId
    })

    this.videoPrivacies = this.videoService.explainedPrivacyLabels(this.videoPrivacies)

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
      this.videoUploaded !== true
  }

  updateSecondStep () {
    if (this.checkForm() === false) {
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
}
