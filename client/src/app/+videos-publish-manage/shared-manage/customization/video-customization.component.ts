
import { Component, OnDestroy, OnInit, inject } from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ServerService } from '@app/core'
import { BuildFormArgumentTyped } from '@app/shared/form-validators/form-validator.model'
import { VIDEO_ORIGINALLY_PUBLISHED_AT_VALIDATOR } from '@app/shared/form-validators/video-validators'
import { FormReactiveErrors, FormReactiveMessages, FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { SelectPlayerThemeComponent } from '@app/shared/shared-forms/select/select-player-theme.component'
import { HTMLServerConfig, PlayerVideoSettings, VideoChannel } from '@peertube/peertube-models'
import debug from 'debug'
import { DatePickerModule } from 'primeng/datepicker'
import { Subscription } from 'rxjs'
import { PeertubeCheckboxComponent } from '../../../shared/shared-forms/peertube-checkbox.component'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { I18nPrimengCalendarService } from '../common/i18n-primeng-calendar.service'
import { VideoEdit } from '../common/video-edit.model'
import { VideoManageController } from '../video-manage-controller.service'
const debugLogger = debug('peertube:video-manage')

type Form = {
  downloadEnabled: FormControl<boolean>
  originallyPublishedAt: FormControl<Date>

  playerSettings: FormGroup<{
    theme: FormControl<PlayerVideoSettings['theme']>
  }>
}

@Component({
  selector: 'my-video-customization',
  styleUrls: [
    '../common/video-manage-page-common.scss'
  ],
  templateUrl: './video-customization.component.html',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    DatePickerModule,
    PeertubeCheckboxComponent,
    GlobalIconComponent,
    SelectPlayerThemeComponent
]
})
export class VideoCustomizationComponent implements OnInit, OnDestroy {
  private formReactiveService = inject(FormReactiveService)
  private serverService = inject(ServerService)
  private i18nPrimengCalendarService = inject(I18nPrimengCalendarService)
  private manageController = inject(VideoManageController)

  form: FormGroup<Form>
  formErrors: FormReactiveErrors = {}
  validationMessages: FormReactiveMessages = {}

  videoEdit: VideoEdit
  videoChannel: Pick<VideoChannel, 'name' | 'displayName'>

  calendarDateFormat: string
  myYearRange: string

  serverConfig: HTMLServerConfig

  private updatedSub: Subscription

  constructor () {
    this.calendarDateFormat = this.i18nPrimengCalendarService.getDateFormat()
    this.myYearRange = this.i18nPrimengCalendarService.getVideoPublicationYearRange()
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()

    const { videoEdit, userChannels } = this.manageController.getStore()
    this.videoEdit = videoEdit

    const channelItem = userChannels.find(c => c.id === videoEdit.toCommonFormPatch().channelId)
    this.videoChannel = { name: channelItem.name, displayName: channelItem.label }

    this.buildForm()
  }

  private buildForm () {
    const defaultValues = { ...this.videoEdit.toCommonFormPatch(), playerSettings: this.videoEdit.toPlayerSettingsFormPatch() }

    const obj: BuildFormArgumentTyped<Form> = {
      downloadEnabled: null,
      originallyPublishedAt: VIDEO_ORIGINALLY_PUBLISHED_AT_VALIDATOR,
      playerSettings: {
        theme: null
      }
    }

    const {
      form,
      formErrors,
      validationMessages
    } = this.formReactiveService.buildForm<Form>(obj, defaultValues)

    this.form = form
    this.formErrors = formErrors
    this.validationMessages = validationMessages

    this.form.valueChanges.subscribe(() => {
      this.manageController.setFormError($localize`Customization`, 'customization', this.formErrors)

      const formValues = this.form.value
      debugLogger('Updating form values', formValues)

      this.videoEdit.loadFromCommonForm(formValues)
      this.videoEdit.loadFromPlayerSettingsForm({
        theme: formValues.playerSettings.theme
      })
    })

    this.formReactiveService.markAllAsDirty(this.form.controls)

    this.updatedSub = this.manageController.getUpdatedObs().subscribe(() => {
      this.form.patchValue({
        ...this.videoEdit.toCommonFormPatch(),
        ...this.videoEdit.toPlayerSettingsFormPatch()
      })
    })
  }

  ngOnDestroy () {
    this.updatedSub?.unsubscribe()
  }

  // ---------------------------------------------------------------------------

  hasPublicationDate () {
    return !!this.form.value.originallyPublishedAt
  }

  resetField (name: string) {
    this.form.patchValue({ [name]: null })
  }
}
