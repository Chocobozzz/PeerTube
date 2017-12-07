import { HttpEventType, HttpResponse } from '@angular/common/http'
import { Component, OnInit, ViewChild } from '@angular/core'
import { FormBuilder, FormGroup } from '@angular/forms'
import { Router } from '@angular/router'
import { NotificationsService } from 'angular2-notifications'
import { VideoService } from 'app/shared/video/video.service'
import { VideoCreate } from '../../../../../shared'
import { AuthService, ServerService } from '../../core'
import { FormReactive } from '../../shared'
import { ValidatorMessage } from '../../shared/forms/form-validators'
import { VideoEdit } from '../../shared/video/video-edit.model'

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
  progressPercent = 0

  error: string = null
  form: FormGroup
  formErrors: { [ id: string ]: string } = {}
  validationMessages: ValidatorMessage = {}
  userVideoChannels = []
  videoPrivacies = []
  firstStepPrivacy = 0
  firstStepChannel = 0

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

    this.videoPrivacies = this.serverService.getVideoPrivacies()
    this.firstStepPrivacy = this.videoPrivacies[0].id

    this.authService.userInformationLoaded
      .subscribe(
        () => {
          const user = this.authService.getUser()
          if (!user) return

          const videoChannels = user.videoChannels
          if (Array.isArray(videoChannels) === false) return

          this.userVideoChannels = videoChannels.map(v => ({ id: v.id, label: v.name }))
          this.firstStepChannel = this.userVideoChannels[0].id
        }
      )
  }

  fileChange ($event) {
    console.log('uploading file ?')
  }

  checkForm () {
    this.forceCheck()

    return this.form.valid
  }

  uploadFirstStep () {
    const formValue: VideoCreate = this.form.value

    const name = formValue.name
    const privacy = formValue.privacy
    const nsfw = formValue.nsfw
    const category = formValue.category
    const licence = formValue.licence
    const language = formValue.language
    const channelId = formValue.channelId
    const description = formValue.description
    const tags = formValue.tags
    const videofile = this.videofileInput.nativeElement.files[0]

    const formData = new FormData()
    formData.append('name', name)
    formData.append('privacy', privacy.toString())
    formData.append('category', '' + category)
    formData.append('nsfw', '' + nsfw)
    formData.append('licence', '' + licence)
    formData.append('channelId', '' + channelId)
    formData.append('videofile', videofile)

    // Language is optional
    if (language) {
      formData.append('language', '' + language)
    }

    formData.append('description', description)

    for (let i = 0; i < tags.length; i++) {
      formData.append(`tags[${i}]`, tags[i])
    }

    this.videoService.uploadVideo(formData).subscribe(
      event => {
        if (event.type === HttpEventType.UploadProgress) {
          this.progressPercent = Math.round(100 * event.loaded / event.total)
        } else if (event instanceof HttpResponse) {
          console.log('Video uploaded.')
          this.notificationsService.success('Success', 'Video uploaded.')

          // Display all the videos once it's finished
          this.router.navigate([ '/videos/trending' ])
        }
      },

      err => {
        // Reset progress
        this.progressPercent = 0
        this.error = err.message
      }
    )
  }

  updateSecondStep () {
    if (this.checkForm() === false) {
      return
    }

    const video = new VideoEdit(this.form.value)

    this.videoService.updateVideo(video)
      .subscribe(
        () => {
          this.notificationsService.success('Success', 'Video published.')
          this.router.navigate([ '/videos/watch', video.uuid ])
        },

        err => {
          this.error = 'Cannot update the video.'
          console.error(err)
        }
      )

  }
}
