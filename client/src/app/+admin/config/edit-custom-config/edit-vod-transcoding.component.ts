import { NgClass, NgFor, NgIf } from '@angular/common'
import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core'
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterLink } from '@angular/router'
import { Notifier } from '@app/core'
import { HTMLServerConfig } from '@peertube/peertube-models'
import { SelectOptionsItem } from 'src/types/select-options-item.model'
import { PeertubeCheckboxComponent } from '../../../shared/shared-forms/peertube-checkbox.component'
import { SelectCustomValueComponent } from '../../../shared/shared-forms/select/select-custom-value.component'
import { SelectOptionsComponent } from '../../../shared/shared-forms/select/select-options.component'
import { PeerTubeTemplateDirective } from '../../../shared/shared-main/common/peertube-template.directive'
import { ConfigService } from '../shared/config.service'
import { EditConfigurationService, ResolutionOption } from './edit-configuration.service'

@Component({
  selector: 'my-edit-vod-transcoding',
  templateUrl: './edit-vod-transcoding.component.html',
  styleUrls: [ './edit-custom-config.component.scss' ],
  imports: [
    FormsModule,
    ReactiveFormsModule,
    PeertubeCheckboxComponent,
    PeerTubeTemplateDirective,
    NgClass,
    NgFor,
    NgIf,
    RouterLink,
    SelectCustomValueComponent,
    SelectOptionsComponent
  ]
})
export class EditVODTranscodingComponent implements OnInit, OnChanges {
  @Input() form: FormGroup
  @Input() formErrors: any
  @Input() serverConfig: HTMLServerConfig

  transcodingThreadOptions: SelectOptionsItem[] = []
  transcodingProfiles: SelectOptionsItem[] = []
  resolutions: ResolutionOption[] = []

  additionalVideoExtensions = ''

  constructor (
    private configService: ConfigService,
    private editConfigurationService: EditConfigurationService,
    private notifier: Notifier
  ) { }

  ngOnInit () {
    this.transcodingThreadOptions = this.configService.transcodingThreadOptions
    this.resolutions = this.editConfigurationService.getTranscodingResolutions()

    this.checkTranscodingFields()
  }

  ngOnChanges (changes: SimpleChanges) {
    if (changes['serverConfig']) {
      this.transcodingProfiles = this.buildAvailableTranscodingProfile()

      this.additionalVideoExtensions = this.serverConfig.video.file.extensions.join(' ')
    }
  }

  buildAvailableTranscodingProfile () {
    const profiles = this.serverConfig.transcoding.availableProfiles

    return profiles.map(p => {
      if (p === 'default') {
        return { id: p, label: $localize`Default`, description: $localize`x264, targeting maximum device compatibility` }
      }

      return { id: p, label: p }
    })
  }

  getResolutionKey (resolution: string) {
    return 'transcoding.resolutions.' + resolution
  }

  isRemoteRunnerVODEnabled () {
    return this.editConfigurationService.isRemoteRunnerVODEnabled(this.form)
  }

  isTranscodingEnabled () {
    return this.editConfigurationService.isTranscodingEnabled(this.form)
  }

  isHLSEnabled () {
    return this.editConfigurationService.isHLSEnabled(this.form)
  }

  isStudioEnabled () {
    return this.editConfigurationService.isStudioEnabled(this.form)
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

  getStudioDisabledClass () {
    return { 'disabled-checkbox-extra': !this.isStudioEnabled() }
  }

  getTotalTranscodingThreads () {
    return this.editConfigurationService.getTotalTranscodingThreads(this.form)
  }

  private checkTranscodingFields () {
    const transcodingControl = this.form.get('transcoding.enabled')
    const videoStudioControl = this.form.get('videoStudio.enabled')
    const hlsControl = this.form.get('transcoding.hls.enabled')
    const webVideosControl = this.form.get('transcoding.webVideos.enabled')

    webVideosControl.valueChanges
      .subscribe(newValue => {
        if (newValue === false && hlsControl.value === false) {
          hlsControl.setValue(true)

          // eslint-disable-next-line max-len
          this.notifier.info($localize`Automatically enable HLS transcoding because at least 1 output format must be enabled when transcoding is enabled`, '', 10000)
        }
      })

    hlsControl.valueChanges
      .subscribe(newValue => {
        if (newValue === false && webVideosControl.value === false) {
          webVideosControl.setValue(true)

          // eslint-disable-next-line max-len
          this.notifier.info($localize`Automatically enable Web Videos transcoding because at least 1 output format must be enabled when transcoding is enabled`, '', 10000)
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
}
