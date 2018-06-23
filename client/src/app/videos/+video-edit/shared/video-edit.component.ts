import { Component, Input, OnInit } from '@angular/core'
import { FormGroup, ValidatorFn, Validators } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { FormReactiveValidationMessages, VideoValidatorsService } from '@app/shared'
import { NotificationsService } from 'angular2-notifications'
import { ServerService } from '../../../core/server'
import { VideoEdit } from '../../../shared/video/video-edit.model'
import { map } from 'rxjs/operators'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { I18nPrimengCalendarService } from '@app/shared/i18n/i18n-primeng-calendar'

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
  @Input() schedulePublicationPossible = true

  // So that it can be accessed in the template
  readonly SPECIAL_SCHEDULED_PRIVACY = VideoEdit.SPECIAL_SCHEDULED_PRIVACY

  videoCategories = []
  videoLicences = []
  videoLanguages = []

  tagValidators: ValidatorFn[]
  tagValidatorsMessages: { [ name: string ]: string }

  schedulePublicationEnabled = false

  calendarLocale: any = {}
  minScheduledDate = new Date()

  calendarTimezone: string
  calendarDateFormat: string

  constructor (
    private formValidatorService: FormValidatorService,
    private videoValidatorsService: VideoValidatorsService,
    private route: ActivatedRoute,
    private router: Router,
    private notificationsService: NotificationsService,
    private serverService: ServerService,
    private i18nPrimengCalendarService: I18nPrimengCalendarService
  ) {
    this.tagValidators = this.videoValidatorsService.VIDEO_TAGS.VALIDATORS
    this.tagValidatorsMessages = this.videoValidatorsService.VIDEO_TAGS.MESSAGES

    this.calendarLocale = this.i18nPrimengCalendarService.getCalendarLocale()
    this.calendarTimezone = this.i18nPrimengCalendarService.getTimezone()
    this.calendarDateFormat = this.i18nPrimengCalendarService.getDateFormat()
  }

  updateForm () {
    const defaultValues = {
      nsfw: 'false',
      commentsEnabled: 'true',
      waitTranscoding: 'true',
      tags: []
    }
    const obj = {
      name: this.videoValidatorsService.VIDEO_NAME,
      privacy: this.videoValidatorsService.VIDEO_PRIVACY,
      channelId: this.videoValidatorsService.VIDEO_CHANNEL,
      nsfw: null,
      commentsEnabled: null,
      waitTranscoding: null,
      category: this.videoValidatorsService.VIDEO_CATEGORY,
      licence: this.videoValidatorsService.VIDEO_LICENCE,
      language: this.videoValidatorsService.VIDEO_LANGUAGE,
      description: this.videoValidatorsService.VIDEO_DESCRIPTION,
      tags: null,
      thumbnailfile: null,
      previewfile: null,
      support: this.videoValidatorsService.VIDEO_SUPPORT,
      schedulePublicationAt: this.videoValidatorsService.VIDEO_SCHEDULE_PUBLICATION_AT
    }

    this.formValidatorService.updateForm(
      this.form,
      this.formErrors,
      this.validationMessages,
      obj,
      defaultValues
    )

    this.trackChannelChange()
    this.trackPrivacyChange()
  }

  ngOnInit () {
    this.updateForm()

    this.videoCategories = this.serverService.getVideoCategories()
    this.videoLicences = this.serverService.getVideoLicences()
    this.videoLanguages = this.serverService.getVideoLanguages()

    setTimeout(() => this.minScheduledDate = new Date(), 1000 * 60) // Update every minute
  }

  private trackPrivacyChange () {
    // We will update the "support" field depending on the channel
    this.form.controls[ 'privacy' ]
      .valueChanges
      .pipe(map(res => parseInt(res.toString(), 10)))
      .subscribe(
        newPrivacyId => {
          this.schedulePublicationEnabled = newPrivacyId === this.SPECIAL_SCHEDULED_PRIVACY

          // Value changed
          const scheduleControl = this.form.get('schedulePublicationAt')
          const waitTranscodingControl = this.form.get('waitTranscoding')

          if (this.schedulePublicationEnabled) {
            scheduleControl.setValidators([ Validators.required ])

            waitTranscodingControl.disable()
            waitTranscodingControl.setValue(false)
          } else {
            scheduleControl.clearValidators()

            waitTranscodingControl.enable()
            waitTranscodingControl.setValue(true)
          }

          scheduleControl.updateValueAndValidity()
          waitTranscodingControl.updateValueAndValidity()
        }
      )
  }

  private trackChannelChange () {
    // We will update the "support" field depending on the channel
    this.form.controls[ 'channelId' ]
      .valueChanges
      .pipe(map(res => parseInt(res.toString(), 10)))
      .subscribe(
        newChannelId => {
          const oldChannelId = parseInt(this.form.value[ 'channelId' ], 10)
          const currentSupport = this.form.value[ 'support' ]

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

  private updateSupportField (support: string) {
    return this.form.patchValue({ support: support || '' })
  }
}
