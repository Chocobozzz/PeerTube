import { CommonModule } from '@angular/common'
import { ChangeDetectorRef, Component, inject, NgZone, OnDestroy, OnInit, viewChild } from '@angular/core'
import { AbstractControl, FormArray, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms'
import { Router, RouterLink } from '@angular/router'
import { VideoChangeOwnershipComponent } from '@app/+my-library/my-videos/modals/video-change-ownership.component'
import { AuthService, ConfirmService, HooksService, Notifier, PluginService, ServerService } from '@app/core'
import { BuildFormArgument, BuildFormValidator } from '@app/shared/form-validators/form-validator.model'
import {
  VIDEO_CATEGORY_VALIDATOR,
  VIDEO_CHANNEL_VALIDATOR,
  VIDEO_DESCRIPTION_VALIDATOR,
  VIDEO_LANGUAGE_VALIDATOR,
  VIDEO_LICENCE_VALIDATOR,
  VIDEO_NAME_VALIDATOR,
  VIDEO_PASSWORD_VALIDATOR,
  VIDEO_PRIVACY_VALIDATOR,
  VIDEO_SCHEDULE_PUBLICATION_AT_VALIDATOR,
  VIDEO_SUPPORT_VALIDATOR,
  VIDEO_TAGS_ARRAY_VALIDATOR
} from '@app/shared/form-validators/video-validators'
import { DynamicFormFieldComponent } from '@app/shared/shared-forms/dynamic-form-field.component'
import { FormReactiveErrors, FormReactiveMessages, FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { FormValidatorService } from '@app/shared/shared-forms/form-validator.service'
import { InputTextComponent } from '@app/shared/shared-forms/input-text.component'
import { MarkdownTextareaComponent } from '@app/shared/shared-forms/markdown-textarea.component'
import { PeertubeCheckboxComponent } from '@app/shared/shared-forms/peertube-checkbox.component'
import { SelectChannelComponent } from '@app/shared/shared-forms/select/select-channel.component'
import { SelectOptionsComponent } from '@app/shared/shared-forms/select/select-options.component'
import { SelectTagsComponent } from '@app/shared/shared-forms/select/select-tags.component'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { PeerTubeTemplateDirective } from '@app/shared/shared-main/common/peertube-template.directive'
import { InstanceService } from '@app/shared/shared-main/instance/instance.service'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import {
  HTMLServerConfig,
  RegisterClientFormFieldOptions,
  RegisterClientVideoFieldOptions,
  VideoConstant,
  VideoPrivacy,
  VideoPrivacyType
} from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { PluginInfo } from '@root-helpers/plugins-manager'
import debug from 'debug'
import { DatePickerModule } from 'primeng/datepicker'
import { forkJoin, Subscription } from 'rxjs'
import { map } from 'rxjs/operators'
import { SelectChannelItem } from 'src/types/select-options-item.model'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { MarkdownHintComponent } from '../../../shared/shared-main/text/markdown-hint.component'
import { I18nPrimengCalendarService } from '../common/i18n-primeng-calendar.service'
import { ThumbnailManagerComponent } from '../common/thumbnail-manager.component'
import { VideoEdit, VideoEditPrivacyType } from '../common/video-edit.model'
import { VideoManageType } from '../common/video-manage.type'
import { VideoManageController } from '../video-manage-controller.service'

const debugLogger = debug('peertube:video-manage')

type PluginField = {
  pluginInfo: PluginInfo
  commonOptions: RegisterClientFormFieldOptions
  videoFormOptions: RegisterClientVideoFieldOptions
}

type Form = {
  name: FormControl<string>
  privacy: FormControl<VideoEditPrivacyType>
  videoPassword: FormControl<string>
  channelId: FormControl<number>
  waitTranscoding: FormControl<boolean>
  category: FormControl<number>
  licence: FormControl<number>
  language: FormControl<string>
  description: FormControl<string>
  tags: FormArray<FormControl<string>>
  previewfile: FormControl<Blob>
  support: FormControl<string>
  schedulePublicationAt: FormControl<Date>
  pluginData: FormGroup
}

@Component({
  selector: 'my-video-main-info',
  styleUrls: [
    '../common/video-manage-page-common.scss'
  ],
  templateUrl: './video-main-info.component.html',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DynamicFormFieldComponent,
    PeerTubeTemplateDirective,
    SelectTagsComponent,
    MarkdownTextareaComponent,
    SelectChannelComponent,
    SelectOptionsComponent,
    InputTextComponent,
    DatePickerModule,
    PeertubeCheckboxComponent,
    ThumbnailManagerComponent,
    GlobalIconComponent,
    MarkdownHintComponent,
    RouterLink,
    VideoChangeOwnershipComponent,
    AlertComponent
  ]
})
export class VideoMainInfoComponent implements OnInit, OnDestroy {
  private formValidatorService = inject(FormValidatorService)
  private authService = inject(AuthService)
  private formReactiveService = inject(FormReactiveService)
  private videoService = inject(VideoService)
  private serverService = inject(ServerService)
  private pluginService = inject(PluginService)
  private instanceService = inject(InstanceService)
  private i18nPrimengCalendarService = inject(I18nPrimengCalendarService)
  private ngZone = inject(NgZone)
  private hooks = inject(HooksService)
  private cd = inject(ChangeDetectorRef)
  private manageController = inject(VideoManageController)
  private confirmService = inject(ConfirmService)
  private notifier = inject(Notifier)
  private router = inject(Router)

  readonly videoChangeOwnershipModal = viewChild<VideoChangeOwnershipComponent>('videoChangeOwnershipModal')

  form: FormGroup<Form>
  formErrors: FormReactiveErrors = {}
  validationMessages: FormReactiveMessages = {}

  forbidScheduledPublication: boolean
  hideWaitTranscoding: boolean

  videoPrivacies: VideoConstant<VideoEditPrivacyType>[] = []
  videoCategories: VideoConstant<number>[] = []
  videoLicences: VideoConstant<number>[] = []
  videoLanguages: VideoConstant<string>[] = []

  pluginDataFormGroup: FormGroup

  schedulePublicationSelected = false
  passwordProtectionSelected = false

  calendarLocale: any = {}
  minScheduledDate = new Date()

  calendarTimezone: string
  calendarDateFormat: string
  myYearRange: string

  serverConfig: HTMLServerConfig

  pluginFields: PluginField[] = []

  manageType: VideoManageType

  firstPatchDone = false

  userChannels: SelectChannelItem[] = []
  privacies: VideoPrivacyType[] = []
  videoEdit: VideoEdit

  ownershipRequestSent: string

  private schedulerInterval: any
  private updatedSub: Subscription

  constructor () {
    this.calendarTimezone = this.i18nPrimengCalendarService.getTimezone()
    this.calendarDateFormat = this.i18nPrimengCalendarService.getDateFormat()
    this.myYearRange = this.i18nPrimengCalendarService.getVideoPublicationYearRange()
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()

    const { videoEdit, userChannels } = this.manageController.getStore()
    this.videoEdit = videoEdit
    this.userChannels = userChannels

    const { manageType, hideWaitTranscoding, forbidScheduledPublication } = this.manageController.getConfig()
    this.manageType = manageType
    this.hideWaitTranscoding = hideWaitTranscoding
    this.forbidScheduledPublication = forbidScheduledPublication

    this.buildForm()

    this.pluginService.ensurePluginsAreLoaded('video-edit')
      .then(() => this.updatePluginFields())

    this.serverService.getVideoCategories()
      .subscribe(res => this.videoCategories = res)

    this.serverService.getVideoLicences()
      .subscribe(res => this.videoLicences = this.videoService.explainedLicenceLabels(res))

    this.buildLanguages()
    this.buildPrivacies()

    this.ngZone.runOutsideAngular(() => {
      this.schedulerInterval = setInterval(() => this.minScheduledDate = new Date(), 1000 * 60) // Update every minute
    })

    const updateFormForPlugins = (values: any) => {
      this.form.patchValue(values)
      this.cd.detectChanges()
    }
    this.hooks.runAction('action:video-edit.init', 'video-edit', { type: this.manageType, updateForm: updateFormForPlugins })

    this.form.valueChanges.subscribe(() => {
      const formValues = this.form.value

      this.hooks.runAction('action:video-edit.form.updated', 'video-edit', { type: this.manageType, formValues })

      this.manageController.setFormError($localize`Main information`, '.', this.formErrors)

      debugLogger('Updating form values', formValues)

      this.videoEdit.loadFromCommonForm(formValues)
    })

    this.formReactiveService.markAllAsDirty(this.form.controls)

    this.updatedSub = this.manageController.getUpdatedObs().subscribe(() => {
      this.form.patchValue(this.videoEdit.toCommonFormPatch())
    })

    this.manageController.registerSaveHook(async () => {
      await this.formReactiveService.waitPendingCheck(this.form)
      this.formReactiveService.forceCheck(this.form, this.formErrors, this.validationMessages)
      this.manageController.setFormError($localize`Main information`, '.', this.formErrors)
    })
  }

  ngOnDestroy () {
    if (this.schedulerInterval) clearInterval(this.schedulerInterval)

    this.updatedSub?.unsubscribe()
    this.manageController.unregisterSaveHook()
    this.videoEdit.disableCheckPluginChanges()
  }

  // ---------------------------------------------------------------------------

  private buildLanguages () {
    forkJoin([
      this.instanceService.getAbout(),
      this.serverService.getVideoLanguages()
    ]).pipe(map(([ about, languages ]) => ({ about, languages })))
      .subscribe(({ about, languages }) => {
        this.videoLanguages = [
          ...languages.filter(l => about.instance.languages.includes(l.id)),

          languages.find(l => l.id === 'zxx'),

          ...languages.filter(l => !about.instance.languages.includes(l.id) && l.id !== 'zxx')
        ]
      })
  }

  private buildPrivacies () {
    const { privacies } = this.manageController.getStore()
    this.videoPrivacies = this.videoService.explainedPrivacyLabels(privacies).videoPrivacies
  }

  private buildForm () {
    const defaultValues = this.videoEdit.toCommonFormPatch()
    const obj: BuildFormArgument = {
      name: VIDEO_NAME_VALIDATOR,
      privacy: VIDEO_PRIVACY_VALIDATOR,
      videoPassword: VIDEO_PASSWORD_VALIDATOR,
      channelId: VIDEO_CHANNEL_VALIDATOR,
      waitTranscoding: null,
      category: VIDEO_CATEGORY_VALIDATOR,
      licence: VIDEO_LICENCE_VALIDATOR,
      language: VIDEO_LANGUAGE_VALIDATOR,
      description: VIDEO_DESCRIPTION_VALIDATOR,
      tags: VIDEO_TAGS_ARRAY_VALIDATOR,
      previewfile: null,
      support: VIDEO_SUPPORT_VALIDATOR,
      schedulePublicationAt: VIDEO_SCHEDULE_PUBLICATION_AT_VALIDATOR
    }

    const {
      form,
      formErrors,
      validationMessages
    } = this.formReactiveService.buildForm<Form>(obj, defaultValues)

    this.form = form
    this.formErrors = formErrors
    this.validationMessages = validationMessages

    this.updateScheduleRelatedControls(defaultValues.privacy, true)

    this.trackChannelChange()
    this.trackPrivacyChange()
  }

  // ---------------------------------------------------------------------------

  getChannelUpdateUrl () {
    const channelId = this.form.value.channelId
    const channel = this.userChannels.find(c => c.id === channelId)

    if (!channel) return ''

    return [ '/my-library/video-channels/update/', channel.name ]
  }

  // ---------------------------------------------------------------------------

  isPluginFieldHidden (pluginField: PluginField) {
    if (typeof pluginField.commonOptions.hidden !== 'function') return false

    return pluginField.commonOptions.hidden({
      formValues: this.form.value,
      videoToUpdate: this.videoEdit,
      liveVideo: this.videoEdit.getLive()
    })
  }

  getPluginsFields (tab: 'main' | 'plugin-settings') {
    return this.pluginFields.filter(p => {
      const wanted = p.videoFormOptions.tab ?? 'plugin-settings'

      return wanted === tab
    })
  }

  private async updatePluginFields () {
    this.pluginFields = this.pluginService.getRegisteredVideoFormFields(this.manageType)
    if (this.pluginFields.length === 0) return

    const { pluginData } = this.videoEdit.toCommonFormPatch()

    const pluginObj: { [id: string]: BuildFormValidator } = {}
    const pluginValidationMessages: FormReactiveMessages = {}
    const pluginFormErrors: FormReactiveErrors = {}
    const pluginDefaults: Record<string, string | boolean> = {}

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

      pluginDefaults[name] = pluginData?.[name] ?? setting.commonOptions.default
    }

    this.pluginDataFormGroup = new FormGroup<any>({})
    this.formValidatorService.updateFormGroup(
      this.pluginDataFormGroup,
      pluginFormErrors,
      pluginValidationMessages,
      pluginObj,
      pluginDefaults
    )

    this.videoEdit.loadPluginDataDefaults(pluginDefaults)
    this.videoEdit.enableCheckPluginChanges()

    this.form.addControl('pluginData', this.pluginDataFormGroup)
    this.formErrors['pluginData'] = pluginFormErrors
    this.validationMessages['pluginData'] = pluginValidationMessages

    this.formReactiveService.markAllAsDirty(this.form.controls)

    this.cd.detectChanges()

    // Plugins may need other control values to calculate potential errors
    this.form.valueChanges.subscribe(() => this.formValidatorService.updateTreeValidity(this.pluginDataFormGroup))
  }

  // ---------------------------------------------------------------------------

  private trackPrivacyChange () {
    // We will update the schedule input and the wait transcoding checkbox validators
    this.form.controls['privacy']
      .valueChanges
      .subscribe(newPrivacyId => this.updateScheduleRelatedControls(newPrivacyId))
  }

  private updateScheduleRelatedControls (newPrivacyId: number, isInitialPatch = false) {
    this.schedulePublicationSelected = newPrivacyId === VideoPrivacy.PREMIERE

    const scheduleControl = this.form.get('schedulePublicationAt')
    const waitTranscodingControl = this.form.get('waitTranscoding')

    if (this.schedulePublicationSelected) {
      scheduleControl.setValidators([ Validators.required ])

      waitTranscodingControl.disable()
      if (!isInitialPatch) waitTranscodingControl.setValue(false)
    } else if (waitTranscodingControl.disabled) {
      scheduleControl.clearValidators()
      waitTranscodingControl.enable()

      // Do not update the control value on first patch (values come from the server)
      if (!isInitialPatch) waitTranscodingControl.setValue(true)
    }

    scheduleControl.updateValueAndValidity()
    waitTranscodingControl.updateValueAndValidity()

    this.passwordProtectionSelected = newPrivacyId === VideoPrivacy.PASSWORD_PROTECTED
    const videoPasswordControl = this.form.get('videoPassword')

    if (this.passwordProtectionSelected) videoPasswordControl.setValidators([ Validators.required, ...VIDEO_PASSWORD_VALIDATOR.VALIDATORS ])
    else videoPasswordControl.clearValidators()

    videoPasswordControl.updateValueAndValidity()
  }

  // ---------------------------------------------------------------------------

  private trackChannelChange () {
    // We will update the "support" field depending on the channel
    this.form.controls.channelId
      .valueChanges
      .subscribe(newChannelId => this.updateSupportFromChannel(newChannelId))
  }

  private updateSupportFromChannel (newChannelId: number) {
    const newChannel = this.userChannels.find(c => c.id === newChannelId)
    if (!newChannel) return

    const currentSupport = this.form.value.support

    const oldChannelId = this.form.value.channelId
    const oldChannel = this.userChannels.find(c => c.id === oldChannelId)
    if (!newChannel || !oldChannel) {
      logger.error('Cannot find new or old channel.')
      return
    }

    // Same channel, no need to update
    if (oldChannelId === newChannel.id) return

    // If the current support text is not the same than the old channel, the user updated it.
    // We don't want the user to lose his text, so stop here
    if (currentSupport && currentSupport !== oldChannel.support) return

    // Update the support text with our new channel
    this.updateSupportField(newChannel.support)
  }

  private updateSupportField (support: string) {
    return this.form.patchValue({ support: support || '' })
  }

  // ---------------------------------------------------------------------------

  canBeDeletedOrTransferred () {
    return !!this.videoEdit.getVideoAttributes().id
  }

  async deleteVideo () {
    const video = this.videoEdit.getVideoAttributes()
    const message = $localize`Are you sure you want to delete your video "${video.name}?`

    const res = await this.confirmService.confirm(message, $localize`Delete`)
    if (res === false) return

    this.videoService.removeVideo(video.id)
      .subscribe({
        next: () => {
          this.notifier.success($localize`"${video.name}" deleted`)

          this.router.navigate([ '/my-library/videos' ])
        },

        error: err => this.notifier.error(err.message)
      })
  }

  // ---------------------------------------------------------------------------

  showChangeOwnershipModal () {
    this.videoChangeOwnershipModal().show()
  }

  onChangeOwnershipRequest (username: string) {
    this.ownershipRequestSent = username
  }

  // ---------------------------------------------------------------------------

  isEditor () {
    return this.videoEdit.getVideoAttributes().ownerAccountId !== this.authService.getUser().account.id
  }
}
