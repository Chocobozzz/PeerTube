import { forkJoin } from 'rxjs'
import { map } from 'rxjs/operators'
import { SelectChannelItem, SelectOptionsItem } from 'src/types/select-options-item.model'
import { ChangeDetectorRef, Component, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output, ViewChild } from '@angular/core'
import { AbstractControl, FormArray, FormControl, FormGroup, Validators } from '@angular/forms'
import { HooksService, PluginService, ServerService } from '@app/core'
import { removeElementFromArray } from '@app/helpers'
import { BuildFormValidator } from '@app/shared/form-validators'
import {
  VIDEO_CATEGORY_VALIDATOR,
  VIDEO_CHANNEL_VALIDATOR,
  VIDEO_DESCRIPTION_VALIDATOR,
  VIDEO_LANGUAGE_VALIDATOR,
  VIDEO_LICENCE_VALIDATOR,
  VIDEO_NAME_VALIDATOR,
  VIDEO_ORIGINALLY_PUBLISHED_AT_VALIDATOR,
  VIDEO_PASSWORD_VALIDATOR,
  VIDEO_PRIVACY_VALIDATOR,
  VIDEO_SCHEDULE_PUBLICATION_AT_VALIDATOR,
  VIDEO_SUPPORT_VALIDATOR,
  VIDEO_TAGS_ARRAY_VALIDATOR
} from '@app/shared/form-validators/video-validators'
import { FormReactiveValidationMessages, FormValidatorService } from '@app/shared/shared-forms'
import { InstanceService } from '@app/shared/shared-instance'
import { VideoCaptionEdit, VideoCaptionWithPathEdit, VideoEdit, VideoService } from '@app/shared/shared-main'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { logger } from '@root-helpers/logger'
import { PluginInfo } from '@root-helpers/plugins-manager'
import {
  HTMLServerConfig,
  LiveVideo,
  LiveVideoLatencyMode,
  RegisterClientFormFieldOptions,
  RegisterClientVideoFieldOptions,
  VideoConstant,
  VideoDetails,
  VideoPrivacy
} from '@shared/models'
import { VideoSource } from '@shared/models/videos/video-source'
import { I18nPrimengCalendarService } from './i18n-primeng-calendar.service'
import { VideoCaptionAddModalComponent } from './video-caption-add-modal.component'
import { VideoCaptionEditModalContentComponent } from './video-caption-edit-modal-content/video-caption-edit-modal-content.component'
import { VideoEditType } from './video-edit.type'

type VideoLanguages = VideoConstant<string> & { group?: string }
type PluginField = {
  pluginInfo: PluginInfo
  commonOptions: RegisterClientFormFieldOptions
  videoFormOptions: RegisterClientVideoFieldOptions
}

@Component({
  selector: 'my-video-edit',
  styleUrls: [ './video-edit.component.scss' ],
  templateUrl: './video-edit.component.html'
})
export class VideoEditComponent implements OnInit, OnDestroy {
  @Input() form: FormGroup
  @Input() formErrors: { [ id: string ]: string } = {}
  @Input() validationMessages: FormReactiveValidationMessages = {}

  @Input() videoToUpdate: VideoDetails

  @Input() userVideoChannels: SelectChannelItem[] = []
  @Input() forbidScheduledPublication = true

  @Input() videoCaptions: VideoCaptionWithPathEdit[] = []
  @Input() videoSource: VideoSource

  @Input() hideWaitTranscoding = false

  @Input() type: VideoEditType
  @Input() liveVideo: LiveVideo

  @ViewChild('videoCaptionAddModal', { static: true }) videoCaptionAddModal: VideoCaptionAddModalComponent

  @Output() formBuilt = new EventEmitter<void>()
  @Output() pluginFieldsAdded = new EventEmitter<void>()

  // So that it can be accessed in the template
  readonly SPECIAL_SCHEDULED_PRIVACY = VideoEdit.SPECIAL_SCHEDULED_PRIVACY

  videoPrivacies: VideoConstant<VideoPrivacy | typeof VideoEdit.SPECIAL_SCHEDULED_PRIVACY > [] = []
  replayPrivacies: VideoConstant<VideoPrivacy> [] = []
  videoCategories: VideoConstant<number>[] = []
  videoLicences: VideoConstant<number>[] = []
  videoLanguages: VideoLanguages[] = []
  latencyModes: SelectOptionsItem[] = [
    {
      id: LiveVideoLatencyMode.SMALL_LATENCY,
      label: $localize`Small latency`,
      description: $localize`Reduce latency to ~15s disabling P2P`
    },
    {
      id: LiveVideoLatencyMode.DEFAULT,
      label: $localize`Default`,
      description: $localize`Average latency of 30s`
    },
    {
      id: LiveVideoLatencyMode.HIGH_LATENCY,
      label: $localize`High latency`,
      description: $localize`Average latency of 60s increasing P2P ratio`
    }
  ]

  pluginDataFormGroup: FormGroup

  schedulePublicationSelected = false
  passwordProtectionSelected = false

  calendarLocale: any = {}
  minScheduledDate = new Date()
  myYearRange = '1880:' + (new Date()).getFullYear()

  calendarTimezone: string
  calendarDateFormat: string

  serverConfig: HTMLServerConfig

  pluginFields: PluginField[] = []

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
    private hooks: HooksService,
    private cd: ChangeDetectorRef,
    private modalService: NgbModal
  ) {
    this.calendarTimezone = this.i18nPrimengCalendarService.getTimezone()
    this.calendarDateFormat = this.i18nPrimengCalendarService.getDateFormat()
  }

  updateForm () {
    const defaultValues: any = {
      nsfw: 'false',
      commentsEnabled: this.serverConfig.defaults.publish.commentsEnabled,
      downloadEnabled: this.serverConfig.defaults.publish.downloadEnabled,
      waitTranscoding: true,
      licence: this.serverConfig.defaults.publish.licence,
      tags: []
    }
    const obj: { [ id: string ]: BuildFormValidator } = {
      name: VIDEO_NAME_VALIDATOR,
      privacy: VIDEO_PRIVACY_VALIDATOR,
      videoPassword: VIDEO_PASSWORD_VALIDATOR,
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
      latencyMode: null,
      saveReplay: null,
      replayPrivacy: null
    }

    this.formValidatorService.updateFormGroup(
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

    this.formBuilt.emit()
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()

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
            if (l.id === 'zxx') return { ...l, group: $localize`Other`, groupOrder: 1 }

            return res.about.instance.languages.includes(l.id)
              ? { ...l, group: $localize`Instance languages`, groupOrder: 0 }
              : { ...l, group: $localize`All languages`, groupOrder: 2 }
          })
          .sort((a, b) => a.groupOrder - b.groupOrder)
      })

    this.serverService.getVideoPrivacies()
      .subscribe(privacies => {
        const videoPrivacies = this.videoService.explainedPrivacyLabels(privacies).videoPrivacies
        this.videoPrivacies = videoPrivacies
        this.replayPrivacies = videoPrivacies.filter((privacy) => privacy.id !== VideoPrivacy.PASSWORD_PROTECTED)

        // Can't schedule publication if private privacy is not available (could be deleted by a plugin)
        const hasPrivatePrivacy = this.videoPrivacies.some(p => p.id === VideoPrivacy.PRIVATE)
        if (this.forbidScheduledPublication || !hasPrivatePrivacy) return

        this.videoPrivacies.push({
          id: this.SPECIAL_SCHEDULED_PRIVACY,
          label: $localize`Scheduled`,
          description: $localize`Hide the video until a specific date`
        })
      })

    this.initialVideoCaptions = this.videoCaptions.map(c => c.language.id)

    this.ngZone.runOutsideAngular(() => {
      this.schedulerInterval = setInterval(() => this.minScheduledDate = new Date(), 1000 * 60) // Update every minute
    })

    const updateFormForPlugins = (values: any) => {
      this.form.patchValue(values)
      this.cd.detectChanges()
    }
    this.hooks.runAction('action:video-edit.init', 'video-edit', { type: this.type, updateForm: updateFormForPlugins })

    this.form.valueChanges.subscribe(() => {
      this.hooks.runAction('action:video-edit.form.updated', 'video-edit', { type: this.type, formValues: this.form.value })
    })
  }

  ngOnDestroy () {
    if (this.schedulerInterval) clearInterval(this.schedulerInterval)
  }

  getExistingCaptions () {
    return this.videoCaptions
               .filter(c => c.action !== 'REMOVE')
               .map(c => c.language.id)
  }

  onCaptionEdited (caption: VideoCaptionEdit) {
    const existingCaption = this.videoCaptions.find(c => c.language.id === caption.language.id)

    // Replace existing caption?
    if (existingCaption) {
      Object.assign(existingCaption, caption)
    } else {
      this.videoCaptions.push(
        Object.assign(caption, { action: 'CREATE' as 'CREATE' })
      )
    }

    this.sortVideoCaptions()
  }

  deleteCaption (caption: VideoCaptionEdit) {
    // Caption recovers his former state
    if (caption.action && this.initialVideoCaptions.includes(caption.language.id)) {
      caption.action = undefined
      return
    }

    // This caption is not on the server, just remove it from our array
    if (caption.action === 'CREATE' || caption.action === 'UPDATE') {
      removeElementFromArray(this.videoCaptions, caption)
      return
    }

    caption.action = 'REMOVE' as 'REMOVE'
  }

  openAddCaptionModal () {
    this.videoCaptionAddModal.show()
  }

  openEditCaptionModal (videoCaption: VideoCaptionWithPathEdit) {
    const modalRef = this.modalService.open(VideoCaptionEditModalContentComponent, { centered: true, keyboard: false })
    modalRef.componentInstance.videoCaption = videoCaption
    modalRef.componentInstance.serverConfig = this.serverConfig
    modalRef.componentInstance.captionEdited.subscribe(this.onCaptionEdited.bind(this))
  }

  isSaveReplayAllowed () {
    return this.serverConfig.live.allowReplay
  }

  isSaveReplayEnabled () {
    return this.form.value['saveReplay'] === true
  }

  isPermanentLiveEnabled () {
    return this.form.value['permanentLive'] === true
  }

  isLatencyModeEnabled () {
    return this.serverConfig.live.latencySetting.enabled
  }

  isPluginFieldHidden (pluginField: PluginField) {
    if (typeof pluginField.commonOptions.hidden !== 'function') return false

    return pluginField.commonOptions.hidden({
      formValues: this.form.value,
      videoToUpdate: this.videoToUpdate,
      liveVideo: this.liveVideo
    })
  }

  getPluginsFields (tab: 'main' | 'plugin-settings') {
    return this.pluginFields.filter(p => {
      const wanted = p.videoFormOptions.tab ?? 'plugin-settings'

      return wanted === tab
    })
  }

  private sortVideoCaptions () {
    this.videoCaptions.sort((v1, v2) => {
      if (v1.language.label < v2.language.label) return -1
      if (v1.language.label === v2.language.label) return 0

      return 1
    })
  }

  private async updatePluginFields () {
    this.pluginFields = this.pluginService.getRegisteredVideoFormFields(this.type)

    if (this.pluginFields.length === 0) return

    const pluginObj: { [ id: string ]: BuildFormValidator } = {}
    const pluginValidationMessages: FormReactiveValidationMessages = {}
    const pluginFormErrors: any = {}
    const pluginDefaults: any = {}

    for (const setting of this.pluginFields) {
      await this.pluginService.translateSetting(setting.pluginInfo.plugin.npmName, setting.commonOptions)

      // Not a form input, just a HTML tag
      if (setting.commonOptions.type === 'html') continue

      const validator = async (control: AbstractControl) => {
        if (!setting.commonOptions.error) return null

        const error = await setting.commonOptions.error({ formValues: this.form.value, value: control.value })

        return error?.error ? { [setting.commonOptions.name]: error.text } : null
      }

      const name = setting.commonOptions.name

      pluginObj[name] = {
        ASYNC_VALIDATORS: [ validator ],
        VALIDATORS: [],
        MESSAGES: {}
      }

      pluginDefaults[name] = setting.commonOptions.default
    }

    this.pluginDataFormGroup = new FormGroup({})
    this.formValidatorService.updateFormGroup(
      this.pluginDataFormGroup,
      pluginFormErrors,
      pluginValidationMessages,
      pluginObj,
      pluginDefaults
    )

    this.form.addControl('pluginData', this.pluginDataFormGroup)
    this.formErrors['pluginData'] = pluginFormErrors
    this.validationMessages['pluginData'] = pluginValidationMessages

    this.cd.detectChanges()
    this.pluginFieldsAdded.emit()

    // Plugins may need other control values to calculate potential errors
    this.form.valueChanges.subscribe(() => this.formValidatorService.updateTreeValidity(this.pluginDataFormGroup))
  }

  private trackPrivacyChange () {
    // We will update the schedule input and the wait transcoding checkbox validators
    this.form.controls['privacy']
      .valueChanges
      .pipe(map(res => parseInt(res.toString(), 10)))
      .subscribe(
        newPrivacyId => {

          this.schedulePublicationSelected = newPrivacyId === this.SPECIAL_SCHEDULED_PRIVACY

          // Value changed
          const scheduleControl = this.form.get('schedulePublicationAt')
          const waitTranscodingControl = this.form.get('waitTranscoding')

          if (this.schedulePublicationSelected) {
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

          this.passwordProtectionSelected = newPrivacyId === VideoPrivacy.PASSWORD_PROTECTED
          const videoPasswordControl = this.form.get('videoPassword')

          if (this.passwordProtectionSelected) {
            videoPasswordControl.setValidators([ Validators.required ])
          } else {
            videoPasswordControl.clearValidators()
          }
          videoPasswordControl.updateValueAndValidity()

        }
      )
  }

  private trackChannelChange () {
    // We will update the "support" field depending on the channel
    this.form.controls['channelId']
      .valueChanges
      .pipe(map(res => parseInt(res.toString(), 10)))
      .subscribe(
        newChannelId => {
          const oldChannelId = parseInt(this.form.value['channelId'], 10)

          // Not initialized yet
          if (isNaN(newChannelId)) return
          const newChannel = this.userVideoChannels.find(c => c.id === newChannelId)
          if (!newChannel) return

          // Wait support field update
          setTimeout(() => {
            const currentSupport = this.form.value['support']

            // First time we set the channel?
            if (isNaN(oldChannelId)) {
              // Fill support if it's empty
              if (!currentSupport) this.updateSupportField(newChannel.support)

              return
            }

            const oldChannel = this.userVideoChannels.find(c => c.id === oldChannelId)
            if (!newChannel || !oldChannel) {
              logger.error('Cannot find new or old channel.')
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

  private updateSupportField (support: string) {
    return this.form.patchValue({ support: support || '' })
  }
}
