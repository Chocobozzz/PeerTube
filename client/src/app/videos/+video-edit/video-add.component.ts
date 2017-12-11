import { HttpEventType, HttpResponse } from '@angular/common/http'
import { Component, OnInit, ViewChild } from '@angular/core'
import { FormBuilder, FormGroup } from '@angular/forms'
import { Router } from '@angular/router'
import { NotificationsService } from 'angular2-notifications'
import { VideoPrivacy } from '../../../../../shared/models/videos'
import { AuthService, ServerService } from '../../core'
import { FormReactive } from '../../shared'
import { ValidatorMessage } from '../../shared/forms/form-validators/validator-message'
import { VideoEdit } from '../../shared/video/video-edit.model'
import { VideoService } from '../../shared/video/video.service'

@Component({
  selector: 'my-videos-add',
  templateUrl: './video-add.component.html',
  styleUrls: [
    './shared/video-edit.component.scss',
    './video-add.component.scss'
  ]
})

export class VideoAddComponent extends FormReactive implements OnInit {
  @ViewChild('videofileInput') videofileInput

  isUploadingVideo = false
  videoUploaded = false
  videoUploadPercents = 0
  videoUploadedId = 0

  error: string = null
  form: FormGroup
  formErrors: { [ id: string ]: string } = {}
  validationMessages: ValidatorMessage = {}

  userVideoChannels = []
  videoPrivacies = []
  firstStepPrivacyId = 0
  firstStepChannelId = 0

  constructor (
    private formBuilder: FormBuilder,
    private router: Router,
    private notificationsService: NotificationsService,
    private authService: AuthService,
    private serverService: ServerService,
    private videoService: VideoService
  ) {
    super()
  }

  buildForm () {
    this.form = this.formBuilder.group({})
    this.form.valueChanges.subscribe(data => this.onValueChanged(data))
  }

  ngOnInit () {
    this.buildForm()

    this.serverService.videoPrivaciesLoaded
      .subscribe(
        () => {
          this.videoPrivacies = this.serverService.getVideoPrivacies()

          // Public by default
          this.firstStepPrivacyId = VideoPrivacy.PUBLIC
        })

    this.authService.userInformationLoaded
      .subscribe(
        () => {
          const user = this.authService.getUser()
          if (!user) return

          const videoChannels = user.videoChannels
          if (Array.isArray(videoChannels) === false) return

          this.userVideoChannels = videoChannels.map(v => ({ id: v.id, label: v.name }))
          this.firstStepChannelId = this.userVideoChannels[0].id
        }
      )
  }

  fileChange () {
    this.uploadFirstStep()
  }

  checkForm () {
    this.forceCheck()

    return this.form.valid
  }

  uploadFirstStep () {
    const videofile = this.videofileInput.nativeElement.files[0]
    const name = videofile.name.replace(/\.[^/.]+$/, '')
    const privacy = this.firstStepPrivacyId.toString()
    const nsfw = false
    const channelId = this.firstStepChannelId.toString()

    const formData = new FormData()
    formData.append('name', name)
    // Put the video "private" -> we wait he validates the second step
    formData.append('privacy', VideoPrivacy.PRIVATE.toString())
    formData.append('nsfw', '' + nsfw)
    formData.append('channelId', '' + channelId)
    formData.append('videofile', videofile)

    this.isUploadingVideo = true
    this.form.patchValue({
      name,
      privacy,
      nsfw,
      channelId
    })

    this.videoService.uploadVideo(formData).subscribe(
      event => {
        if (event.type === HttpEventType.UploadProgress) {
          this.videoUploadPercents = Math.round(100 * event.loaded / event.total)
        } else if (event instanceof HttpResponse) {
          console.log('Video uploaded.')

          this.videoUploaded = true

          this.videoUploadedId = event.body.video.id
        }
      },

      err => {
        // Reset progress
        this.videoUploadPercents = 0
        this.error = err.message
      }
    )
  }

  updateSecondStep () {
    if (this.checkForm() === false) {
      return
    }

    const video = new VideoEdit()
    video.patch(this.form.value)
    video.channel = this.firstStepChannelId
    video.id = this.videoUploadedId

    this.videoService.updateVideo(video)
      .subscribe(
        () => {
          this.notificationsService.success('Success', 'Video published.')
          this.router.navigate([ '/videos/watch', video.id ])
        },

        err => {
          this.error = 'Cannot update the video.'
          console.error(err)
        }
      )

  }
}
