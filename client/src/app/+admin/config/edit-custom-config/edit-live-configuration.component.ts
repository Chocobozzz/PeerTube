
import { SelectOptionsItem } from 'src/types/select-options-item.model'
import { Component, Input, OnInit } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { ServerConfig } from '@shared/models'
import { ConfigService } from '../shared/config.service'
import { EditConfigurationService, ResolutionOption } from './edit-configuration.service'

@Component({
  selector: 'my-edit-live-configuration',
  templateUrl: './edit-live-configuration.component.html',
  styleUrls: [ './edit-custom-config.component.scss' ]
})
export class EditLiveConfigurationComponent implements OnInit {
  @Input() form: FormGroup
  @Input() formErrors: any
  @Input() serverConfig: ServerConfig

  transcodingThreadOptions: SelectOptionsItem[] = []
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

    this.liveResolutions = this.editConfigurationService.getLiveResolutions()
  }

  getAvailableTranscodingProfile () {
    const profiles = this.serverConfig.live.transcoding.availableProfiles

    return profiles.map(p => {
      const description = p === 'default'
        ? $localize`x264, targeting maximum device compatibility`
        : ''

      return { id: p, label: p, description }
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

  getDisabledLiveClass () {
    return { 'disabled-checkbox-extra': !this.isLiveEnabled() }
  }

  getDisabledLiveTranscodingClass () {
    return { 'disabled-checkbox-extra': !this.isLiveEnabled() || !this.isLiveTranscodingEnabled() }
  }

  isLiveTranscodingEnabled () {
    return this.editConfigurationService.isLiveTranscodingEnabled(this.form)
  }

  getTotalTranscodingThreads () {
    return this.editConfigurationService.getTotalTranscodingThreads(this.form)
  }
}
