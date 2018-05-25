import { Component, Input, OnInit } from '@angular/core'
import { FormBuilder, FormControl, FormGroup } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { VIDEO_IMAGE, VIDEO_SUPPORT } from '@app/shared'
import { NotificationsService } from 'angular2-notifications'
import { ServerService } from '../../../core/server'
import { VIDEO_CHANNEL } from '../../../shared/forms/form-validators'
import { ValidatorMessage } from '../../../shared/forms/form-validators/validator-message'
import {
  VIDEO_CATEGORY,
  VIDEO_DESCRIPTION,
  VIDEO_LANGUAGE,
  VIDEO_LICENCE,
  VIDEO_NAME,
  VIDEO_PRIVACY,
  VIDEO_TAGS
} from '../../../shared/forms/form-validators/video'
import { VideoEdit } from '../../../shared/video/video-edit.model'
import { map } from 'rxjs/operators'

@Component({
  selector: 'my-video-edit',
  styleUrls: [ './video-edit.component.scss' ],
  templateUrl: './video-edit.component.html'
})

export class VideoEditComponent implements OnInit {
  @Input() form: FormGroup
  @Input() formErrors: { [ id: string ]: string } = {}
  @Input() validationMessages: ValidatorMessage = {}
  @Input() videoPrivacies = []
  @Input() userVideoChannels: { id: number, label: string, support: string }[] = []

  videoCategories = []
  videoLicences = []
  videoLanguages = []
  video: VideoEdit

  tagValidators = VIDEO_TAGS.VALIDATORS
  tagValidatorsMessages = VIDEO_TAGS.MESSAGES

  error: string = null

  constructor (
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private notificationsService: NotificationsService,
    private serverService: ServerService
  ) { }

  updateForm () {
    this.formErrors['name'] = ''
    this.formErrors['privacy'] = ''
    this.formErrors['channelId'] = ''
    this.formErrors['category'] = ''
    this.formErrors['licence'] = ''
    this.formErrors['language'] = ''
    this.formErrors['description'] = ''
    this.formErrors['thumbnailfile'] = ''
    this.formErrors['previewfile'] = ''
    this.formErrors['support'] = ''

    this.validationMessages['name'] = VIDEO_NAME.MESSAGES
    this.validationMessages['privacy'] = VIDEO_PRIVACY.MESSAGES
    this.validationMessages['channelId'] = VIDEO_CHANNEL.MESSAGES
    this.validationMessages['category'] = VIDEO_CATEGORY.MESSAGES
    this.validationMessages['licence'] = VIDEO_LICENCE.MESSAGES
    this.validationMessages['language'] = VIDEO_LANGUAGE.MESSAGES
    this.validationMessages['description'] = VIDEO_DESCRIPTION.MESSAGES
    this.validationMessages['thumbnailfile'] = VIDEO_IMAGE.MESSAGES
    this.validationMessages['previewfile'] = VIDEO_IMAGE.MESSAGES
    this.validationMessages['support'] = VIDEO_SUPPORT.MESSAGES

    this.form.addControl('name', new FormControl('', VIDEO_NAME.VALIDATORS))
    this.form.addControl('privacy', new FormControl('', VIDEO_PRIVACY.VALIDATORS))
    this.form.addControl('channelId', new FormControl('', VIDEO_CHANNEL.VALIDATORS))
    this.form.addControl('nsfw', new FormControl(false))
    this.form.addControl('commentsEnabled', new FormControl(true))
    this.form.addControl('category', new FormControl('', VIDEO_CATEGORY.VALIDATORS))
    this.form.addControl('licence', new FormControl('', VIDEO_LICENCE.VALIDATORS))
    this.form.addControl('language', new FormControl('', VIDEO_LANGUAGE.VALIDATORS))
    this.form.addControl('description', new FormControl('', VIDEO_DESCRIPTION.VALIDATORS))
    this.form.addControl('tags', new FormControl([]))
    this.form.addControl('thumbnailfile', new FormControl(''))
    this.form.addControl('previewfile', new FormControl(''))
    this.form.addControl('support', new FormControl('', VIDEO_SUPPORT.VALIDATORS))

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
