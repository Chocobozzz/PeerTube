import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core'
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
  downloadOriginalFileEnabled: FormControl<boolean>
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
  changeDetection: ChangeDetectionStrategy.Eager,
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

  serverConfig: HTMLServerConfig

  private updatedSub: Subscription

  constructor () {
    this.calendarDateFormat = this.i18nPrimengCalendarService.getDateFormat()
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()

    const { videoEdit } = this.manageController.getStore()
    this.videoEdit = videoEdit

    const attributes = this.videoEdit.getVideoAttributes()
    this.videoChannel = {
      name: attributes.channelName,
      displayName: attributes.channelDisplayName
    }

    this.buildForm()
  }

  private buildForm () {
    const defaultValues = { ...this.videoEdit.toCommonFormPatch(), playerSettings: this.videoEdit.toPlayerSettingsFormPatch() }

    const obj: BuildFormArgumentTyped<Form> = {
      downloadEnabled: null,
      downloadOriginalFileEnabled: null,
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

    // Original file download is only relevant when download is enabled: keep the option visible but disabled otherwise
    const downloadEnabledControl = this.form.get('downloadEnabled')
    this.updateDownloadOriginalFileState(downloadEnabledControl.value)
    downloadEnabledControl.valueChanges.subscribe(enabled => this.updateDownloadOriginalFileState(enabled))

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

  hasOriginalFileToDownload () {
    // On upload there is no source yet, so rely on the instance config to know if the original file will be kept
    if (this.videoEdit.isNew()) {
      return this.serverConfig.transcoding.originalFile.keep
    }

    // On update, the option only makes sense if the video actually has an original source file
    return !!this.videoEdit.getVideoSource()?.fileDownloadUrl
  }

  private updateDownloadOriginalFileState (downloadEnabled: boolean) {
    const control = this.form.get('downloadOriginalFileEnabled')

    if (downloadEnabled) {
      control.enable({ emitEvent: false })
    } else {
      // Keep the form value consistent so we never submit downloadOriginalFileEnabled=true with downloadEnabled=false
      control.setValue(false)
      control.disable({ emitEvent: false })
    }
  }

  resetField (name: string) {
    this.form.patchValue({ [name]: null })
  }
}
