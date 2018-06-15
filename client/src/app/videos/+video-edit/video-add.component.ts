import { HttpEventType, HttpResponse } from '@angular/common/http'
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { Router } from '@angular/router'
import { UserService } from '@app/shared'
import { CanComponentDeactivate } from '@app/shared/guards/can-deactivate-guard.service'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { NotificationsService } from 'angular2-notifications'
import { BytesPipe } from 'ngx-pipes'
import { Subscription } from 'rxjs'
import { VideoPrivacy } from '../../../../../shared/models/videos'
import { AuthService, ServerService } from '../../core'
import { FormReactive } from '../../shared'
import { populateAsyncUserVideoChannels } from '../../shared/misc/utils'
import { VideoEdit } from '../../shared/video/video-edit.model'
import { VideoService } from '../../shared/video/video.service'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'

@Component({
  selector: 'my-videos-add',
  templateUrl: './video-add.component.html',
  styleUrls: [
    './shared/video-edit.component.scss',
    './video-add.component.scss'
  ]
})
export class VideoAddComponent extends FormReactive implements OnInit, OnDestroy, CanComponentDeactivate {
  @ViewChild('videofileInput') videofileInput

  // So that it can be accessed in the template
  readonly SPECIAL_SCHEDULED_PRIVACY = VideoEdit.SPECIAL_SCHEDULED_PRIVACY

  isUploadingVideo = false
  isUpdatingVideo = false
  videoUploaded = false
  videoUploadObservable: Subscription = null
  videoUploadPercents = 0
  videoUploadedIds = {
    id: 0,
    uuid: ''
  }
  videoFileName: string

  userVideoChannels: { id: number, label: string, support: string }[] = []
  userVideoQuotaUsed = 0
  videoPrivacies = []
  firstStepPrivacyId = 0
  firstStepChannelId = 0

  constructor (
    protected formValidatorService: FormValidatorService,
    private router: Router,
    private notificationsService: NotificationsService,
    private authService: AuthService,
    private userService: UserService,
    private serverService: ServerService,
    private videoService: VideoService,
    private loadingBar: LoadingBarService,
    private i18n: I18n
  ) {
    super()
  }

  get videoExtensions () {
    return this.serverService.getConfig().video.file.extensions.join(',')
  }

  ngOnInit () {
    this.buildForm({})

    populateAsyncUserVideoChannels(this.authService, this.userVideoChannels)
      .then(() => this.firstStepChannelId = this.userVideoChannels[0].id)

    this.userService.getMyVideoQuotaUsed()
      .subscribe(data => this.userVideoQuotaUsed = data.videoQuotaUsed)

    this.serverService.videoPrivaciesLoaded
      .subscribe(
        () => {
          this.videoPrivacies = this.serverService.getVideoPrivacies()

          // Public by default
          this.firstStepPrivacyId = VideoPrivacy.PUBLIC
        })
  }

  ngOnDestroy () {
    if (this.videoUploadObservable) {
      this.videoUploadObservable.unsubscribe()
    }
  }

  canDeactivate () {
    let text = ''

    if (this.videoUploaded === true) {
      // FIXME: cannot concatenate strings inside i18n service :/
      text = this.i18n('Your video was uploaded in your account and is private.') +
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

  checkForm () {
    this.forceCheck()

    return this.form.valid
  }

  cancelUpload () {
    if (this.videoUploadObservable !== null) {
      this.videoUploadObservable.unsubscribe()
      this.isUploadingVideo = false
      this.videoUploadPercents = 0
      this.videoUploadObservable = null
      this.notificationsService.info(this.i18n('Info'), this.i18n('Upload cancelled'))
    }
  }

  uploadFirstStep () {
    const videofile = this.videofileInput.nativeElement.files[0] as File
    if (!videofile) return

    // Cannot upload videos > 4GB for now
    if (videofile.size > 4 * 1024 * 1024 * 1024) {
      this.notificationsService.error(this.i18n('Error'), this.i18n('We are sorry but PeerTube cannot handle videos > 4GB'))
      return
    }

    const videoQuota = this.authService.getUser().videoQuota
    if (videoQuota !== -1 && (this.userVideoQuotaUsed + videofile.size) > videoQuota) {
      const bytePipes = new BytesPipe()

      const msg = this.i18n(
        'Your video quota is exceeded with this video (video size: {{ videoSize }}, used: {{ videoQuotaUsed }}, quota: {{ videoQuota }})',
        {
          videoSize: bytePipes.transform(videofile.size, 0),
          videoQuotaUsed: bytePipes.transform(this.userVideoQuotaUsed, 0),
          videoQuota: bytePipes.transform(videoQuota, 0)
        }
      )
      this.notificationsService.error(this.i18n('Error'), msg)
      return
    }

    this.videoFileName = videofile.name

    const nameWithoutExtension = videofile.name.replace(/\.[^/.]+$/, '')
    let name: string

    // If the name of the file is very small, keep the extension
    if (nameWithoutExtension.length < 3) {
      name = videofile.name
    } else {
      name = nameWithoutExtension
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
    this.form.patchValue({
      name,
      privacy,
      nsfw,
      channelId
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
        this.notificationsService.error(this.i18n('Error'), err.message)
      }
    )
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
    this.loadingBar.start()
    this.videoService.updateVideo(video)
      .subscribe(
        () => {
          this.isUpdatingVideo = false
          this.isUploadingVideo = false
          this.loadingBar.complete()

          this.notificationsService.success(this.i18n('Success'), this.i18n('Video published.'))
          this.router.navigate([ '/videos/watch', video.uuid ])
        },

        err => {
          this.isUpdatingVideo = false
          this.notificationsService.error(this.i18n('Error'), err.message)
          console.error(err)
        }
      )

  }
}
