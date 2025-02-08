import { SelectOptionsItem } from 'src/types/select-options-item.model'
import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core'
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { HTMLServerConfig } from '@peertube/peertube-models'
import { ConfigService } from '../shared/config.service'
import { EditConfigurationService, ResolutionOption } from './edit-configuration.service'
import { SelectCustomValueComponent } from '../../../shared/shared-forms/select/select-custom-value.component'
import { RouterLink } from '@angular/router'
import { SelectOptionsComponent } from '../../../shared/shared-forms/select/select-options.component'
import { NgClass, NgIf, NgFor } from '@angular/common'
import { PeerTubeTemplateDirective } from '../../../shared/shared-main/common/peertube-template.directive'
import { PeertubeCheckboxComponent } from '../../../shared/shared-forms/peertube-checkbox.component'

@Component({
  selector: 'my-edit-live-configuration',
  templateUrl: './edit-live-configuration.component.html',
  styleUrls: [ './edit-custom-config.component.scss' ],
  imports: [
    FormsModule,
    ReactiveFormsModule,
    PeertubeCheckboxComponent,
    PeerTubeTemplateDirective,
    NgClass,
    NgIf,
    SelectOptionsComponent,
    NgFor,
    RouterLink,
    SelectCustomValueComponent
  ]
})
export class EditLiveConfigurationComponent implements OnInit, OnChanges {
  @Input() form: FormGroup
  @Input() formErrors: any
  @Input() serverConfig: HTMLServerConfig

  transcodingThreadOptions: SelectOptionsItem[] = []
  transcodingProfiles: SelectOptionsItem[] = []

  liveMaxDurationOptions: SelectOptionsItem[] = []
  liveResolutions: ResolutionOption[] = []

  constructor (
    private configService: ConfigService,
    private editConfigurationService: EditConfigurationService
  ) { }

  ngOnInit () {
    this.transcodingThreadOptions = this.configService.transcodingThreadOptions

    this.liveMaxDurationOptions = [
      { id: -1, label: $localize`No limit` },
      { id: 1000 * 3600, label: $localize`1 hour` },
      { id: 1000 * 3600 * 3, label: $localize`3 hours` },
      { id: 1000 * 3600 * 5, label: $localize`5 hours` },
      { id: 1000 * 3600 * 10, label: $localize`10 hours` }
    ]

    this.liveResolutions = this.editConfigurationService.getTranscodingResolutions()
  }

  ngOnChanges (changes: SimpleChanges) {
    if (changes['serverConfig']) {
      this.transcodingProfiles = this.buildAvailableTranscodingProfile()
    }
  }

  buildAvailableTranscodingProfile () {
    const profiles = this.serverConfig.live.transcoding.availableProfiles

    return profiles.map(p => {
      if (p === 'default') {
        return { id: p, label: $localize`Default`, description: $localize`x264, targeting maximum device compatibility` }
      }

      return { id: p, label: p }
    })
  }

  getResolutionKey (resolution: string) {
    return 'live.transcoding.resolutions.' + resolution
  }

  getLiveRTMPPort () {
    return this.serverConfig.live.rtmp.port
  }

  isLiveEnabled () {
    return this.editConfigurationService.isLiveEnabled(this.form)
  }

  isRemoteRunnerLiveEnabled () {
    return this.editConfigurationService.isRemoteRunnerLiveEnabled(this.form)
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
    return this.editConfigurationService.isLiveTranscodingEnabled(this.form)
  }

  getTotalTranscodingThreads () {
    return this.editConfigurationService.getTotalTranscodingThreads(this.form)
  }
}
