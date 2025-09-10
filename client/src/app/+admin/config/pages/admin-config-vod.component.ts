import { CommonModule } from '@angular/common'
import { Component, OnInit, OnDestroy, inject } from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { CanComponentDeactivate, Notifier, ServerService } from '@app/core'
import {
  CONCURRENCY_VALIDATOR,
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
import { Subscription } from 'rxjs'
import { SelectOptionsItem } from 'src/types/select-options-item.model'
import { AdminConfigService, FormResolutions, ResolutionOption } from '../../../shared/shared-admin/admin-config.service'
import { PeertubeCheckboxComponent } from '../../../shared/shared-forms/peertube-checkbox.component'
import { SelectCustomValueComponent } from '../../../shared/shared-forms/select/select-custom-value.component'
import { SelectOptionsComponent } from '../../../shared/shared-forms/select/select-options.component'
import { PeerTubeTemplateDirective } from '../../../shared/shared-main/common/peertube-template.directive'
import { AdminSaveBarComponent } from '../shared/admin-save-bar.component'

type Form = {
  transcoding: FormGroup<{
    enabled: FormControl<boolean>
    allowAdditionalExtensions: FormControl<boolean>
    allowAudioFiles: FormControl<boolean>

    originalFile: FormGroup<{
      keep: FormControl<boolean>
    }>

    webVideos: FormGroup<{
      enabled: FormControl<boolean>
    }>

    hls: FormGroup<{
      enabled: FormControl<boolean>
      splitAudioAndVideo: FormControl<boolean>
    }>

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
    concurrency: FormControl<number>
  }>

  videoStudio: FormGroup<{
    enabled: FormControl<boolean>
    remoteRunners: FormGroup<{
      enabled: FormControl<boolean>
    }>
  }>
}

@Component({
  selector: 'my-admin-config-vod',
  templateUrl: './admin-config-vod.component.html',
  styleUrls: [ './admin-config-common.scss' ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PeertubeCheckboxComponent,
    PeerTubeTemplateDirective,
    RouterLink,
    SelectCustomValueComponent,
    SelectOptionsComponent,
    AdminSaveBarComponent
  ]
})
export class AdminConfigVODComponent implements OnInit, OnDestroy, CanComponentDeactivate {
  private configService = inject(AdminConfigService)
  private notifier = inject(Notifier)
  private server = inject(ServerService)
  private route = inject(ActivatedRoute)
  private formReactiveService = inject(FormReactiveService)
  private adminConfigService = inject(AdminConfigService)

  form: FormGroup<Form>
  formErrors: FormReactiveErrorsTyped<Form> = {}
  validationMessages: FormReactiveMessagesTyped<Form> = {}

  transcodingThreadOptions: SelectOptionsItem[] = []
  transcodingProfiles: SelectOptionsItem[] = []
  resolutions: ResolutionOption[] = []

  additionalVideoExtensions = ''

  private customConfig: CustomConfig
  private customConfigSub: Subscription

  ngOnInit () {
    const serverConfig = this.server.getHTMLConfig()

    this.customConfig = this.route.parent.snapshot.data['customConfig']

    this.transcodingThreadOptions = this.configService.transcodingThreadOptions
    this.resolutions = this.adminConfigService.getTranscodingOptions('vod')
    this.additionalVideoExtensions = serverConfig.video.file.extensions.join(' ')
    this.transcodingProfiles = this.adminConfigService.buildTranscodingProfiles(serverConfig.transcoding.availableProfiles)

    this.buildForm()

    this.subscribeToTranscodingChanges()

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
      transcoding: {
        enabled: null,
        allowAdditionalExtensions: null,
        allowAudioFiles: null,

        originalFile: {
          keep: null
        },

        webVideos: {
          enabled: null
        },

        hls: {
          enabled: null,
          splitAudioAndVideo: null
        },

        fps: {
          max: TRANSCODING_MAX_FPS_VALIDATOR
        },

        resolutions: this.adminConfigService.buildFormResolutions('vod'),
        alwaysTranscodeOriginalResolution: null,

        remoteRunners: {
          enabled: null
        },

        threads: TRANSCODING_THREADS_VALIDATOR,

        profile: null,
        concurrency: CONCURRENCY_VALIDATOR
      },

      videoStudio: {
        enabled: null,
        remoteRunners: {
          enabled: null
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
    return 'transcoding.resolutions.' + resolution
  }

  isRemoteRunnerVODEnabled () {
    return this.form.value.transcoding.remoteRunners.enabled === true
  }

  isTranscodingEnabled () {
    return this.form.value.transcoding.enabled === true
  }

  isHLSEnabled () {
    return this.form.value.transcoding.hls.enabled === true
  }

  isStudioEnabled () {
    return this.form.value.videoStudio.enabled === true
  }

  getTranscodingDisabledClass () {
    return { 'disabled-checkbox-extra': !this.isTranscodingEnabled() }
  }

  getHLSDisabledClass () {
    return { 'disabled-checkbox-extra': !this.isHLSEnabled() }
  }

  getLocalTranscodingDisabledClass () {
    return { 'disabled-checkbox-extra': !this.isTranscodingEnabled() || this.isRemoteRunnerVODEnabled() }
  }

  getStudioRunnerDisabledClass () {
    return { 'disabled-checkbox-extra': !this.isStudioEnabled() }
  }

  getTotalTranscodingThreads () {
    return this.adminConfigService.getTotalTranscodingThreads({
      live: this.customConfig.live,
      transcoding: {
        enabled: this.form.value.transcoding.enabled,
        threads: this.form.value.transcoding.threads
      }
    })
  }

  private subscribeToTranscodingChanges () {
    const controls = this.form.controls

    const transcodingControl = controls.transcoding.controls.enabled
    const videoStudioControl = controls.videoStudio.controls.enabled
    const hlsControl = controls.transcoding.controls.hls.controls.enabled
    const webVideosControl = controls.transcoding.controls.webVideos.controls.enabled

    webVideosControl.valueChanges
      .subscribe(newValue => {
        if (newValue === false && hlsControl.value === false) {
          hlsControl.setValue(true)

          this.notifier.info(
            $localize`Automatically enable HLS transcoding because at least 1 output format must be enabled when transcoding is enabled`,
            '',
            10000
          )
        }
      })

    hlsControl.valueChanges
      .subscribe(newValue => {
        if (newValue === false && webVideosControl.value === false) {
          webVideosControl.setValue(true)

          this.notifier.info(
            // eslint-disable-next-line max-len
            $localize`Automatically enable Web Videos transcoding because at least 1 output format must be enabled when transcoding is enabled`,
            '',
            10000
          )
        }
      })

    transcodingControl.valueChanges
      .subscribe(newValue => {
        if (newValue === false) {
          videoStudioControl.setValue(false)
        }
      })

    transcodingControl.updateValueAndValidity()
    webVideosControl.updateValueAndValidity()
    videoStudioControl.updateValueAndValidity()
    hlsControl.updateValueAndValidity()
  }

  save () {
    this.adminConfigService.saveAndUpdateCurrent({
      currentConfig: this.customConfig,
      form: this.form,
      formConfig: this.form.value,
      success: $localize`VOD configuration updated.`
    })
  }

  checkTranscodingConsistentOptions () {
    return this.adminConfigService.checkTranscodingConsistentOptions({
      transcoding: {
        enabled: this.form.value.transcoding.enabled
      },
      live: this.customConfig.live
    })
  }
}
