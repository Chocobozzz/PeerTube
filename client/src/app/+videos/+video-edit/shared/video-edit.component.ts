import { forkJoin } from 'rxjs'
import { map } from 'rxjs/operators'
import { Component, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output, ViewChild } from '@angular/core'
import { FormArray, FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms'
import { HooksService, PluginService, ServerService } from '@app/core'
import { removeElementFromArray } from '@app/helpers'
import {
  VIDEO_CATEGORY_VALIDATOR,
  VIDEO_CHANNEL_VALIDATOR,
  VIDEO_DESCRIPTION_VALIDATOR,
  VIDEO_LANGUAGE_VALIDATOR,
  VIDEO_LICENCE_VALIDATOR,
  VIDEO_NAME_VALIDATOR,
  VIDEO_ORIGINALLY_PUBLISHED_AT_VALIDATOR,
  VIDEO_PRIVACY_VALIDATOR,
  VIDEO_SCHEDULE_PUBLICATION_AT_VALIDATOR,
  VIDEO_SUPPORT_VALIDATOR,
  VIDEO_TAGS_ARRAY_VALIDATOR
} from '@app/shared/form-validators/video-validators'
import { FormReactiveValidationMessages, FormValidatorService, SelectChannelItem } from '@app/shared/shared-forms'
import { InstanceService } from '@app/shared/shared-instance'
import { VideoCaptionEdit, VideoEdit, VideoService } from '@app/shared/shared-main'
import { ServerConfig, VideoConstant, LiveVideo, VideoPrivacy } from '@shared/models'
import { RegisterClientFormFieldOptions, RegisterClientVideoFieldOptions } from '@shared/models/plugins/register-client-form-field.model'
import { I18nPrimengCalendarService } from './i18n-primeng-calendar.service'
import { VideoCaptionAddModalComponent } from './video-caption-add-modal.component'
import { VideoEditType } from './video-edit.type'

type VideoLanguages = VideoConstant<string> & { group?: string }

@Component({
  selector: 'my-video-edit',
  styleUrls: [ './video-edit.component.scss' ],
  templateUrl: './video-edit.component.html'
})
export class VideoEditComponent implements OnInit, OnDestroy {
  @Input() form: FormGroup
  @Input() formErrors: { [ id: string ]: string } = {}
  @Input() validationMessages: FormReactiveValidationMessages = {}
  @Input() userVideoChannels: SelectChannelItem[] = []
  @Input() schedulePublicationPossible = true
  @Input() videoCaptions: (VideoCaptionEdit & { captionPath?: string })[] = []
  @Input() waitTranscodingEnabled = true
  @Input() type: VideoEditType
  @Input() liveVideo: LiveVideo

  @ViewChild('videoCaptionAddModal', { static: true }) videoCaptionAddModal: VideoCaptionAddModalComponent

  @Output() pluginFieldsAdded = new EventEmitter<void>()

  // So that it can be accessed in the template
  readonly SPECIAL_SCHEDULED_PRIVACY = VideoEdit.SPECIAL_SCHEDULED_PRIVACY

  videoPrivacies: VideoConstant<VideoPrivacy>[] = []
  videoCategories: VideoConstant<number>[] = []
  videoLicences: VideoConstant<number>[] = []
  videoLanguages: VideoLanguages[] = []

  tagValidators: ValidatorFn[]
  tagValidatorsMessages: { [ name: string ]: string }

  pluginDataFormGroup: FormGroup

  schedulePublicationEnabled = false

  calendarLocale: any = {}
  minScheduledDate = new Date()
  myYearRange = '1880:' + (new Date()).getFullYear()

  calendarTimezone: string
  calendarDateFormat: string

  serverConfig: ServerConfig

  pluginFields: {
    commonOptions: RegisterClientFormFieldOptions
    videoFormOptions: RegisterClientVideoFieldOptions
  }[] = []

  private schedulerInterval: any
  private firstPatchDone = false
  private initialVideoCaptions: string[] = []

  constructor (
    private formValidatorService: FormValidatorService,
    private videoService: VideoService,
    private serverService: ServerService,
    private pluginService: PluginService,
    private instanceService: InstanceService,
    private i18nPrimengCalendarService: I18nPrimengCalendarService,
    private ngZone: NgZone,
    private hooks: HooksService
  ) {
    this.calendarLocale = this.i18nPrimengCalendarService.getCalendarLocale()
    this.calendarTimezone = this.i18nPrimengCalendarService.getTimezone()
    this.calendarDateFormat = this.i18nPrimengCalendarService.getDateFormat()
  }

  updateForm () {
    const defaultValues: any = {
      nsfw: 'false',
      commentsEnabled: 'true',
      downloadEnabled: 'true',
      waitTranscoding: 'true',
      tags: []
    }
    const obj: any = {
      name: VIDEO_NAME_VALIDATOR,
      privacy: VIDEO_PRIVACY_VALIDATOR,
      channelId: VIDEO_CHANNEL_VALIDATOR,
      nsfw: null,
      commentsEnabled: null,
      downloadEnabled: null,
      waitTranscoding: null,
      category: VIDEO_CATEGORY_VALIDATOR,
      licence: VIDEO_LICENCE_VALIDATOR,
      language: VIDEO_LANGUAGE_VALIDATOR,
      description: VIDEO_DESCRIPTION_VALIDATOR,
      tags: VIDEO_TAGS_ARRAY_VALIDATOR,
      previewfile: null,
      support: VIDEO_SUPPORT_VALIDATOR,
      schedulePublicationAt: VIDEO_SCHEDULE_PUBLICATION_AT_VALIDATOR,
      originallyPublishedAt: VIDEO_ORIGINALLY_PUBLISHED_AT_VALIDATOR,
      liveStreamKey: null,
      permanentLive: null,
      saveReplay: null
    }

    this.formValidatorService.updateForm(
      this.form,
      this.formErrors,
      this.validationMessages,
      obj,
      defaultValues
    )

    this.form.addControl('captions', new FormArray([
      new FormGroup({
        language: new FormControl(),
        captionfile: new FormControl()
      })
    ]))

    this.trackChannelChange()
    this.trackPrivacyChange()
    this.trackLivePermanentFieldChange()
  }

  ngOnInit () {
    this.updateForm()

    this.pluginService.ensurePluginsAreLoaded('video-edit')
      .then(() => this.updatePluginFields())

    this.serverService.getVideoCategories()
        .subscribe(res => this.videoCategories = res)

    this.serverService.getVideoLicences()
        .subscribe(res => this.videoLicences = res)

    forkJoin([
      this.instanceService.getAbout(),
      this.serverService.getVideoLanguages()
    ]).pipe(map(([ about, languages ]) => ({ about, languages })))
      .subscribe(res => {
        this.videoLanguages = res.languages
          .map(l => {
            return res.about.instance.languages.includes(l.id)
              ? { ...l, group: $localize`Instance languages`, groupOrder: 0 }
              : { ...l, group: $localize`All languages`, groupOrder: 1 }
          })
          .sort((a, b) => a.groupOrder - b.groupOrder)
      })

    this.serverService.getVideoPrivacies()
      .subscribe(privacies => {
        this.videoPrivacies = this.videoService.explainedPrivacyLabels(privacies)
        if (this.schedulePublicationPossible) {
          this.videoPrivacies.push({
            id: this.SPECIAL_SCHEDULED_PRIVACY,
            label: $localize`Scheduled`,
            description: $localize`Hide the video until a specific date`
          })
        }
      })

    this.serverConfig = this.serverService.getTmpConfig()
    this.serverService.getConfig()
      .subscribe(config => this.serverConfig = config)

    this.initialVideoCaptions = this.videoCaptions.map(c => c.language.id)

    this.ngZone.runOutsideAngular(() => {
      this.schedulerInterval = setInterval(() => this.minScheduledDate = new Date(), 1000 * 60) // Update every minute
    })

    this.hooks.runAction('action:video-edit.init', 'video-edit', { type: this.type })
  }

  ngOnDestroy () {
    if (this.schedulerInterval) clearInterval(this.schedulerInterval)
  }

  getExistingCaptions () {
    return this.videoCaptions
               .filter(c => c.action !== 'REMOVE')
               .map(c => c.language.id)
  }

  onCaptionAdded (caption: VideoCaptionEdit) {
    const existingCaption = this.videoCaptions.find(c => c.language.id === caption.language.id)

    // Replace existing caption?
    if (existingCaption) {
      Object.assign(existingCaption, caption, { action: 'CREATE' as 'CREATE' })
    } else {
      this.videoCaptions.push(
        Object.assign(caption, { action: 'CREATE' as 'CREATE' })
      )
    }

    this.sortVideoCaptions()
  }

  async deleteCaption (caption: VideoCaptionEdit) {
    // Caption recovers his former state
    if (caption.action && this.initialVideoCaptions.indexOf(caption.language.id) !== -1) {
      caption.action = undefined
      return
    }

    // This caption is not on the server, just remove it from our array
    if (caption.action === 'CREATE') {
      removeElementFromArray(this.videoCaptions, caption)
      return
    }

    caption.action = 'REMOVE' as 'REMOVE'
  }

  openAddCaptionModal () {
    this.videoCaptionAddModal.show()
  }

  isSaveReplayEnabled () {
    return this.serverConfig.live.allowReplay
  }

  isPermanentLiveEnabled () {
    return this.form.value['permanentLive'] === true
  }

  private sortVideoCaptions () {
    this.videoCaptions.sort((v1, v2) => {
      if (v1.language.label < v2.language.label) return -1
      if (v1.language.label === v2.language.label) return 0

      return 1
    })
  }

  private updatePluginFields () {
    this.pluginFields = this.pluginService.getRegisteredVideoFormFields(this.type)

    if (this.pluginFields.length === 0) return

    const obj: any = {}

    for (const setting of this.pluginFields) {
      obj[setting.commonOptions.name] = new FormControl(setting.commonOptions.default)
    }

    this.pluginDataFormGroup = new FormGroup(obj)
    this.form.addControl('pluginData', this.pluginDataFormGroup)

    this.pluginFieldsAdded.emit()
  }

  private trackPrivacyChange () {
    // We will update the schedule input and the wait transcoding checkbox validators
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

            // Do not update the control value on first patch (values come from the server)
            if (this.firstPatchDone === true) {
              waitTranscodingControl.setValue(true)
            }
          }

          scheduleControl.updateValueAndValidity()
          waitTranscodingControl.updateValueAndValidity()

          this.firstPatchDone = true

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

          // Not initialized yet
          if (isNaN(newChannelId)) return
          const newChannel = this.userVideoChannels.find(c => c.id === newChannelId)
          if (!newChannel) return

          // Wait support field update
          setTimeout(() => {
            const currentSupport = this.form.value[ 'support' ]

            // First time we set the channel?
            if (isNaN(oldChannelId)) {
              // Fill support if it's empty
              if (!currentSupport) this.updateSupportField(newChannel.support)

              return
            }

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
          })
        }
      )
  }

  private trackLivePermanentFieldChange () {
    // We will update the "support" field depending on the channel
    this.form.controls['permanentLive']
      .valueChanges
      .subscribe(
        permanentLive => {
          const saveReplayControl = this.form.controls['saveReplay']

          if (permanentLive === true) {
            saveReplayControl.setValue(false)
            saveReplayControl.disable()
          } else {
            saveReplayControl.enable()
          }
        }
      )
  }

  private updateSupportField (support: string) {
    return this.form.patchValue({ support: support || '' })
  }
}
