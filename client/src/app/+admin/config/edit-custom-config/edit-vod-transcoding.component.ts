import { SelectOptionsItem } from 'src/types/select-options-item.model'
import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core'
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { HTMLServerConfig } from '@peertube/peertube-models'
import { ConfigService } from '../shared/config.service'
import { EditConfigurationService, ResolutionOption } from './edit-configuration.service'
import { SelectOptionsComponent } from '../../../shared/shared-forms/select/select-options.component'
import { SelectCustomValueComponent } from '../../../shared/shared-forms/select/select-custom-value.component'
import { RouterLink } from '@angular/router'
import { NgClass, NgFor, NgIf } from '@angular/common'
import { PeerTubeTemplateDirective } from '../../../shared/shared-main/angular/peertube-template.directive'
import { PeertubeCheckboxComponent } from '../../../shared/shared-forms/peertube-checkbox.component'

@Component({
  selector: 'my-edit-vod-transcoding',
  templateUrl: './edit-vod-transcoding.component.html',
  styleUrls: [ './edit-custom-config.component.scss' ],
  standalone: true,
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
    private editConfigurationService: EditConfigurationService
  ) { }

  ngOnInit () {
    this.transcodingThreadOptions = this.configService.transcodingThreadOptions
    this.resolutions = this.editConfigurationService.getVODResolutions()

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

  isStudioEnabled () {
    return this.editConfigurationService.isStudioEnabled(this.form)
  }

  getTranscodingDisabledClass () {
    return { 'disabled-checkbox-extra': !this.isTranscodingEnabled() }
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
                       if (newValue === false && !hlsControl.disabled) {
                         hlsControl.disable()
                       }

                       if (newValue === true && !hlsControl.enabled) {
                         hlsControl.enable()
                       }
                     })

    hlsControl.valueChanges
              .subscribe(newValue => {
                if (newValue === false && !webVideosControl.disabled) {
                  webVideosControl.disable()
                }

                if (newValue === true && !webVideosControl.enabled) {
                  webVideosControl.enable()
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
