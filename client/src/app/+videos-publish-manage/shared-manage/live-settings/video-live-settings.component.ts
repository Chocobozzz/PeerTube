import { CommonModule } from '@angular/common'
import { Component, OnDestroy, OnInit, inject } from '@angular/core'
import { FormArray, FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ServerService } from '@app/core'
import { BuildFormArgument } from '@app/shared/form-validators/form-validator.model'
import { FormReactiveErrors, FormReactiveService, FormReactiveMessages } from '@app/shared/shared-forms/form-reactive.service'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import {
  HTMLServerConfig,
  LiveVideoLatencyMode,
  LiveVideoLatencyModeType,
  VideoConstant,
  VideoPrivacy,
  VideoPrivacyType,
  VideoState
} from '@peertube/peertube-models'
import debug from 'debug'
import { Subscription } from 'rxjs'
import { SelectOptionsItem } from 'src/types/select-options-item.model'
import { InputTextComponent } from '../../../shared/shared-forms/input-text.component'
import { PeertubeCheckboxComponent } from '../../../shared/shared-forms/peertube-checkbox.component'
import { SelectOptionsComponent } from '../../../shared/shared-forms/select/select-options.component'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { PeerTubeTemplateDirective } from '../../../shared/shared-main/common/peertube-template.directive'
import { TimeDurationFormatterPipe } from '../../../shared/shared-main/date/time-duration-formatter.pipe'
import { VideoEdit } from '../common/video-edit.model'
import { VideoManageController } from '../video-manage-controller.service'
import { LiveDocumentationLinkComponent } from './live-documentation-link.component'
import { LiveStreamInformationComponent } from './live-stream-information.component'
import { I18nPrimengCalendarService } from '../common/i18n-primeng-calendar.service'
import { DatePickerModule } from 'primeng/datepicker'

const debugLogger = debug('peertube:video-manage')

type Form = {
  liveStreamKey: FormControl<string>
  permanentLive: FormControl<boolean>
  latencyMode: FormControl<LiveVideoLatencyModeType>
  saveReplay: FormControl<boolean>
  replayPrivacy: FormControl<VideoPrivacyType>

  schedules: FormArray<
    FormGroup<{
      startAt: FormControl<Date>
    }>
  >
}

@Component({
  selector: 'my-video-live-settings',
  styleUrls: [
    '../common/video-manage-page-common.scss'
  ],
  templateUrl: './video-live-settings.component.html',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PeerTubeTemplateDirective,
    SelectOptionsComponent,
    InputTextComponent,
    DatePickerModule,
    PeertubeCheckboxComponent,
    LiveDocumentationLinkComponent,
    AlertComponent,
    TimeDurationFormatterPipe,
    GlobalIconComponent,
    LiveStreamInformationComponent
  ]
})
export class VideoLiveSettingsComponent implements OnInit, OnDestroy {
  private formReactiveService = inject(FormReactiveService)
  private videoService = inject(VideoService)
  private serverService = inject(ServerService)
  private i18nPrimengCalendarService = inject(I18nPrimengCalendarService)
  private manageController = inject(VideoManageController)

  form: FormGroup<Form>
  formErrors: FormReactiveErrors = {}
  validationMessages: FormReactiveMessages = {}

  videoEdit: VideoEdit

  calendarDateFormat: string
  myYearRange: string

  replayPrivacies: VideoConstant<VideoPrivacyType>[] = []

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

  serverConfig: HTMLServerConfig

  private updatedSub: Subscription

  constructor () {
    this.calendarDateFormat = this.i18nPrimengCalendarService.getDateFormat()
    this.myYearRange = this.i18nPrimengCalendarService.getVideoPublicationYearRange()
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()

    const { videoEdit } = this.manageController.getStore()
    this.videoEdit = videoEdit

    this.buildForm()

    this.serverService.getVideoPrivacies()
      .subscribe(privacies => {
        this.replayPrivacies = this.videoService.explainedPrivacyLabels(privacies)
          .videoPrivacies
          .filter(privacy => privacy.id !== VideoPrivacy.PASSWORD_PROTECTED)
      })
  }

  ngOnDestroy () {
    this.updatedSub?.unsubscribe()
  }

  private buildForm () {
    const defaultValues = this.videoEdit.toLiveFormPatch()

    const obj: BuildFormArgument = {
      liveStreamKey: null,
      permanentLive: null,
      latencyMode: null,
      saveReplay: null,
      replayPrivacy: null
    }

    const {
      form,
      formErrors,
      validationMessages
    } = this.formReactiveService.buildForm<Form>(obj, defaultValues)

    this.form = form
    this.formErrors = formErrors
    this.validationMessages = validationMessages

    this.form.addControl(
      'schedules',
      new FormArray([
        new FormGroup({
          startAt: new FormControl<Date>(defaultValues.schedules?.[0]?.startAt, null)
        })
      ])
    )

    this.form.valueChanges.subscribe(() => {
      this.manageController.setFormError($localize`Live settings`, 'live-settings', this.formErrors)

      const formValues = this.form.value
      debugLogger('Updating form values', formValues)

      this.videoEdit.loadFromLiveForm(formValues)
    })

    this.formReactiveService.markAllAsDirty(this.form.controls)

    this.updatedSub = this.manageController.getUpdatedObs().subscribe(() => {
      this.form.patchValue(this.videoEdit.toLiveFormPatch())
    })
  }

  isSaveReplayAllowed () {
    return this.serverConfig.live.allowReplay
  }

  isSaveReplayEnabled () {
    return this.form.value.saveReplay === true
  }

  isPermanentLiveEnabled () {
    return this.form.value.permanentLive === true
  }

  isLatencyModeEnabled () {
    return this.serverConfig.live.latencySetting.enabled
  }

  isLive () {
    return this.videoEdit.getVideoAttributes().isLive
  }

  hasEnded () {
    return this.videoEdit.getVideoAttributes().state === VideoState.LIVE_ENDED
  }

  isStreaming () {
    return this.videoEdit.getVideoAttributes().state === VideoState.PUBLISHED
  }

  getLive () {
    return this.videoEdit.getVideoAttributes().live
  }

  getVideoName () {
    return this.videoEdit.getVideoAttributes().name
  }

  getMaxLiveDuration () {
    return this.serverConfig.live.maxDuration / 1000
  }

  getInstanceName () {
    return this.serverConfig.instance.name
  }

  hasScheduledDate () {
    return !!this.form.value.schedules?.length && this.form.value.schedules[0].startAt
  }

  resetSchedule () {
    this.form.patchValue({
      schedules: [
        {
          startAt: null
        }
      ]
    })
  }
}
