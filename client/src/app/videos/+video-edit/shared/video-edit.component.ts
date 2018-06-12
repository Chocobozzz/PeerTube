import { Component, Input, OnInit } from '@angular/core'
import { FormGroup, ValidatorFn } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { FormReactiveValidationMessages, VideoValidatorsService } from '@app/shared'
import { NotificationsService } from 'angular2-notifications'
import { ServerService } from '../../../core/server'
import { VideoEdit } from '../../../shared/video/video-edit.model'
import { map } from 'rxjs/operators'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'

@Component({
  selector: 'my-video-edit',
  styleUrls: [ './video-edit.component.scss' ],
  templateUrl: './video-edit.component.html'
})

export class VideoEditComponent implements OnInit {
  @Input() form: FormGroup
  @Input() formErrors: { [ id: string ]: string } = {}
  @Input() validationMessages: FormReactiveValidationMessages = {}
  @Input() videoPrivacies = []
  @Input() userVideoChannels: { id: number, label: string, support: string }[] = []

  videoCategories = []
  videoLicences = []
  videoLanguages = []
  video: VideoEdit

  tagValidators: ValidatorFn[]
  tagValidatorsMessages: { [ name: string ]: string }

  error: string = null

  constructor (
    private formValidatorService: FormValidatorService,
    private videoValidatorsService: VideoValidatorsService,
    private route: ActivatedRoute,
    private router: Router,
    private notificationsService: NotificationsService,
    private serverService: ServerService
  ) {
    this.tagValidators = this.videoValidatorsService.VIDEO_TAGS.VALIDATORS
    this.tagValidatorsMessages = this.videoValidatorsService.VIDEO_TAGS.MESSAGES
  }

  updateForm () {
    const defaultValues = {
      nsfw: 'false',
      commentsEnabled: 'true',
      tags: []
    }
    const obj = {
      name: this.videoValidatorsService.VIDEO_NAME,
      privacy: this.videoValidatorsService.VIDEO_PRIVACY,
      channelId: this.videoValidatorsService.VIDEO_CHANNEL,
      nsfw: null,
      commentsEnabled: null,
      category: this.videoValidatorsService.VIDEO_CATEGORY,
      licence: this.videoValidatorsService.VIDEO_LICENCE,
      language: this.videoValidatorsService.VIDEO_LANGUAGE,
      description: this.videoValidatorsService.VIDEO_DESCRIPTION,
      tags: null,
      thumbnailfile: null,
      previewfile: null,
      support: this.videoValidatorsService.VIDEO_SUPPORT
    }

    this.formValidatorService.updateForm(
      this.form,
      this.formErrors,
      this.validationMessages,
      obj,
      defaultValues
    )

    // We will update the "support" field depending on the channel
    this.form.controls['channelId']
      .valueChanges
      .pipe(map(res => parseInt(res.toString(), 10)))
      .subscribe(
        newChannelId => {
          const oldChannelId = parseInt(this.form.value['channelId'], 10)
          const currentSupport = this.form.value['support']

          // Not initialized yet
          if (isNaN(newChannelId)) return
          const newChannel = this.userVideoChannels.find(c => c.id === newChannelId)
          if (!newChannel) return

          // First time we set the channel?
          if (isNaN(oldChannelId)) return this.updateSupportField(newChannel.support)
          const oldChannel = this.userVideoChannels.find(c => c.id === oldChannelId)

          if (!newChannel || !oldChannel) {
            console.error('Cannot find new or old channel.')
            return
          }

          // If the current support text is not the same than the old channel, the user updated it.
          // We don't want the user to lose his text, so stop here
          if (currentSupport && currentSupport !== oldChannel.support) return

          // Update the support text with our new channel
          this.updateSupportField(newChannel.support)
        }
      )
  }

  ngOnInit () {
    this.updateForm()

    this.videoCategories = this.serverService.getVideoCategories()
    this.videoLicences = this.serverService.getVideoLicences()
    this.videoLanguages = this.serverService.getVideoLanguages()
  }

  private updateSupportField (support: string) {
    return this.form.patchValue({ support: support || '' })
  }
}
