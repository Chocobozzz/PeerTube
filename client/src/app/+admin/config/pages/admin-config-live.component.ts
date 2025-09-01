import { CommonModule } from '@angular/common'
import { Component, OnInit, OnDestroy, inject } from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { CanComponentDeactivate, ServerService } from '@app/core'
import {
  MAX_INSTANCE_LIVES_VALIDATOR,
  MAX_LIVE_DURATION_VALIDATOR,
  MAX_USER_LIVES_VALIDATOR,
  TRANSCODING_MAX_FPS_VALIDATOR,
  TRANSCODING_THREADS_VALIDATOR
} from '@app/shared/form-validators/custom-config-validators'
import {
  BuildFormArgumentTyped,
  FormDefaultTyped,
  FormReactiveErrorsTyped,
  FormReactiveMessagesTyped
} from '@app/shared/form-validators/form-validator.model'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { CustomConfig } from '@peertube/peertube-models'
import { SelectOptionsItem } from 'src/types/select-options-item.model'
import { PeertubeCheckboxComponent } from '../../../shared/shared-forms/peertube-checkbox.component'
import { SelectCustomValueComponent } from '../../../shared/shared-forms/select/select-custom-value.component'
import { SelectOptionsComponent } from '../../../shared/shared-forms/select/select-options.component'
import { PeerTubeTemplateDirective } from '../../../shared/shared-main/common/peertube-template.directive'
import { AdminConfigService, FormResolutions, ResolutionOption } from '../../../shared/shared-admin/admin-config.service'
import { AdminSaveBarComponent } from '../shared/admin-save-bar.component'
import { Subscription } from 'rxjs'

type Form = {
  live: FormGroup<{
    enabled: FormControl<boolean>
    allowReplay: FormControl<boolean>
    latencySetting: FormGroup<{
      enabled: FormControl<boolean>
    }>
    maxInstanceLives: FormControl<number>
    maxUserLives: FormControl<number>
    maxDuration: FormControl<number>

    transcoding: FormGroup<{
      enabled: FormControl<boolean>

      fps: FormGroup<{
        max: FormControl<number>
      }>

      resolutions: FormGroup<FormResolutions>
      alwaysTranscodeOriginalResolution: FormControl<boolean>

      remoteRunners: FormGroup<{
        enabled: FormControl<boolean>
      }>

      threads: FormControl<number>
      profile: FormControl<string>
    }>
  }>
}

@Component({
  selector: 'my-admin-config-live',
  templateUrl: './admin-config-live.component.html',
  styleUrls: [ './admin-config-common.scss' ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PeertubeCheckboxComponent,
    PeerTubeTemplateDirective,
    SelectOptionsComponent,
    RouterLink,
    SelectCustomValueComponent,
    AdminSaveBarComponent
  ]
})
export class AdminConfigLiveComponent implements OnInit, OnDestroy, CanComponentDeactivate {
  private configService = inject(AdminConfigService)
  private server = inject(ServerService)
  private route = inject(ActivatedRoute)
  private formReactiveService = inject(FormReactiveService)
  private adminConfigService = inject(AdminConfigService)

  form: FormGroup<Form>
  formErrors: FormReactiveErrorsTyped<Form> = {}
  validationMessages: FormReactiveMessagesTyped<Form> = {}

  transcodingThreadOptions: SelectOptionsItem[] = []
  transcodingProfiles: SelectOptionsItem[] = []

  liveMaxDurationOptions: SelectOptionsItem[] = []
  liveResolutions: ResolutionOption[] = []

  private customConfig: CustomConfig
  private customConfigSub: Subscription

  ngOnInit () {
    this.customConfig = this.route.parent.snapshot.data['customConfig']

    this.transcodingThreadOptions = this.configService.transcodingThreadOptions

    this.liveMaxDurationOptions = [
      { id: -1, label: $localize`No limit` },
      { id: 1000 * 3600, label: $localize`1 hour` },
      { id: 1000 * 3600 * 3, label: $localize`3 hours` },
      { id: 1000 * 3600 * 5, label: $localize`5 hours` },
      { id: 1000 * 3600 * 10, label: $localize`10 hours` }
    ]

    this.liveResolutions = this.adminConfigService.getTranscodingOptions('live')
    this.transcodingProfiles = this.adminConfigService.buildTranscodingProfiles(
      this.server.getHTMLConfig().live.transcoding.availableProfiles
    )

    this.buildForm()

    this.customConfigSub = this.adminConfigService.getCustomConfigReloadedObs()
      .subscribe(customConfig => {
        this.customConfig = customConfig

        this.form.patchValue(this.customConfig)
      })
  }

  ngOnDestroy () {
    if (this.customConfigSub) this.customConfigSub.unsubscribe()
  }

  private buildForm () {
    const obj: BuildFormArgumentTyped<Form> = {
      live: {
        enabled: null,
        allowReplay: null,

        maxDuration: MAX_LIVE_DURATION_VALIDATOR,
        maxInstanceLives: MAX_INSTANCE_LIVES_VALIDATOR,
        maxUserLives: MAX_USER_LIVES_VALIDATOR,
        latencySetting: {
          enabled: null
        },

        transcoding: {
          enabled: null,
          threads: TRANSCODING_THREADS_VALIDATOR,
          profile: null,
          resolutions: this.adminConfigService.buildFormResolutions('live'),
          alwaysTranscodeOriginalResolution: null,
          remoteRunners: {
            enabled: null
          },
          fps: {
            max: TRANSCODING_MAX_FPS_VALIDATOR
          }
        }
      }
    }

    const defaultValues: FormDefaultTyped<Form> = this.customConfig

    const {
      form,
      formErrors,
      validationMessages
    } = this.formReactiveService.buildForm<Form>(obj, defaultValues)

    this.form = form
    this.formErrors = formErrors
    this.validationMessages = validationMessages
  }

  canDeactivate () {
    return { canDeactivate: !this.form.dirty }
  }

  getResolutionKey (resolution: string) {
    return 'live.transcoding.resolutions.' + resolution
  }

  getLiveRTMPPort () {
    return this.server.getHTMLConfig().live.rtmp.port
  }

  isLiveEnabled () {
    return this.form.value.live.enabled === true
  }

  isRemoteRunnerLiveEnabled () {
    return this.form.value.live.transcoding.remoteRunners.enabled === true
  }

  getDisabledLiveClass () {
    return { 'disabled-checkbox-extra': !this.isLiveEnabled() }
  }

  getDisabledLiveTranscodingClass () {
    return { 'disabled-checkbox-extra': !this.isLiveEnabled() || !this.isLiveTranscodingEnabled() }
  }

  getDisabledLiveLocalTranscodingClass () {
    return { 'disabled-checkbox-extra': !this.isLiveEnabled() || !this.isLiveTranscodingEnabled() || this.isRemoteRunnerLiveEnabled() }
  }

  isLiveTranscodingEnabled () {
    return this.form.value.live.transcoding.enabled === true
  }

  getTotalTranscodingThreads () {
    return this.adminConfigService.getTotalTranscodingThreads({
      transcoding: this.customConfig.transcoding,
      live: {
        transcoding: {
          enabled: this.form.value.live.transcoding.enabled,
          threads: this.form.value.live.transcoding.threads
        }
      }
    })
  }

  save () {
    this.adminConfigService.saveAndUpdateCurrent({
      currentConfig: this.customConfig,
      form: this.form,
      formConfig: this.form.value,
      success: $localize`Live configuration updated.`
    })
  }

  checkTranscodingConsistentOptions () {
    return this.adminConfigService.checkTranscodingConsistentOptions({
      transcoding: this.customConfig.transcoding,
      live: {
        enabled: this.form.value.live.enabled,
        allowReplay: this.form.value.live.allowReplay
      }
    })
  }
}
