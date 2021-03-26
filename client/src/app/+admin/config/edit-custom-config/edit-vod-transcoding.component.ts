
import { SelectOptionsItem } from 'src/types/select-options-item.model'
import { Component, Input, OnInit } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { ServerConfig } from '@shared/models'
import { ConfigService } from '../shared/config.service'
import { EditConfigurationService, ResolutionOption } from './edit-configuration.service'

@Component({
  selector: 'my-edit-vod-transcoding',
  templateUrl: './edit-vod-transcoding.component.html',
  styleUrls: [ './edit-custom-config.component.scss' ]
})
export class EditVODTranscodingComponent implements OnInit {
  @Input() form: FormGroup
  @Input() formErrors: any
  @Input() serverConfig: ServerConfig

  transcodingThreadOptions: SelectOptionsItem[] = []
  resolutions: ResolutionOption[] = []

  constructor (
    private configService: ConfigService,
    private editConfigurationService: EditConfigurationService
  ) { }

  ngOnInit () {
    this.transcodingThreadOptions = this.configService.transcodingThreadOptions
    this.resolutions = this.editConfigurationService.getVODResolutions()

    this.checkTranscodingFields()
  }

  getAvailableTranscodingProfile () {
    const profiles = this.serverConfig.transcoding.availableProfiles

    return profiles.map(p => {
      const description = p === 'default'
        ? $localize`x264, targeting maximum device compatibility`
        : ''

      return { id: p, label: p, description }
    })
  }

  getResolutionKey (resolution: string) {
    return 'transcoding.resolutions.' + resolution
  }

  isTranscodingEnabled () {
    return this.editConfigurationService.isTranscodingEnabled(this.form)
  }

  getTranscodingDisabledClass () {
    return { 'disabled-checkbox-extra': !this.isTranscodingEnabled() }
  }

  getTotalTranscodingThreads () {
    return this.editConfigurationService.getTotalTranscodingThreads(this.form)
  }

  private checkTranscodingFields () {
    const hlsControl = this.form.get('transcoding.hls.enabled')
    const webtorrentControl = this.form.get('transcoding.webtorrent.enabled')

    webtorrentControl.valueChanges
                     .subscribe(newValue => {
                       if (newValue === false && !hlsControl.disabled) {
                         hlsControl.disable()
                       }

                       if (newValue === true && !hlsControl.enabled) {
                         hlsControl.enable()
                       }
                     })

    hlsControl.valueChanges
              .subscribe(newValue => {
                if (newValue === false && !webtorrentControl.disabled) {
                  webtorrentControl.disable()
                }

                if (newValue === true && !webtorrentControl.enabled) {
                  webtorrentControl.enable()
                }
              })
  }
}
