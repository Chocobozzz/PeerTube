import { NgClass, NgFor, NgIf } from '@angular/common'
import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core'
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterLink } from '@angular/router'
import { ThemeService } from '@app/core'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { HTMLServerConfig } from '@peertube/peertube-models'
import { pairwise } from 'rxjs/operators'
import { SelectOptionsItem } from 'src/types/select-options-item.model'
import { MarkdownTextareaComponent } from '../../../shared/shared-forms/markdown-textarea.component'
import { PeertubeCheckboxComponent } from '../../../shared/shared-forms/peertube-checkbox.component'
import { SelectCustomValueComponent } from '../../../shared/shared-forms/select/select-custom-value.component'
import { SelectOptionsComponent } from '../../../shared/shared-forms/select/select-options.component'
import { HelpComponent } from '../../../shared/shared-main/buttons/help.component'
import { UserRealQuotaInfoComponent } from '../../shared/user-real-quota-info.component'
import { ConfigService } from '../shared/config.service'

@Component({
  selector: 'my-edit-basic-configuration',
  templateUrl: './edit-basic-configuration.component.html',
  styleUrls: [ './edit-custom-config.component.scss' ],
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    NgFor,
    SelectCustomValueComponent,
    NgIf,
    PeertubeCheckboxComponent,
    HelpComponent,
    MarkdownTextareaComponent,
    NgClass,
    UserRealQuotaInfoComponent,
    SelectOptionsComponent,
    AlertComponent
  ]
})
export class EditBasicConfigurationComponent implements OnInit, OnChanges {
  @Input() form: FormGroup
  @Input() formErrors: any

  @Input() serverConfig: HTMLServerConfig

  signupAlertMessage: string
  defaultLandingPageOptions: SelectOptionsItem[] = []
  availableThemes: SelectOptionsItem[]

  exportExpirationOptions: SelectOptionsItem[] = []
  exportMaxUserVideoQuotaOptions: SelectOptionsItem[] = []

  constructor (
    private configService: ConfigService,
    private themeService: ThemeService
  ) {}

  ngOnInit () {
    this.buildLandingPageOptions()
    this.checkSignupField()
    this.checkImportSyncField()

    this.availableThemes = [
      this.themeService.getDefaultThemeItem(),

      ...this.themeService.buildAvailableThemes()
    ]

    this.exportExpirationOptions = [
      { id: 1000 * 3600 * 24, label: $localize`1 day` },
      { id: 1000 * 3600 * 24 * 2, label: $localize`2 days` },
      { id: 1000 * 3600 * 24 * 7, label: $localize`7 days` },
      { id: 1000 * 3600 * 24 * 30, label: $localize`30 days` }
    ]

    this.exportMaxUserVideoQuotaOptions = this.configService.videoQuotaOptions.filter(o => (o.id as number) >= 1)
  }

  ngOnChanges (changes: SimpleChanges) {
    if (changes['serverConfig']) {
      this.buildLandingPageOptions()
    }
  }

  countExternalAuth () {
    return this.serverConfig.plugin.registeredExternalAuths.length
  }

  getVideoQuotaOptions () {
    return this.configService.videoQuotaOptions
  }

  getVideoQuotaDailyOptions () {
    return this.configService.videoQuotaDailyOptions
  }

  doesTrendingVideosAlgorithmsEnabledInclude (algorithm: string) {
    const enabled = this.form.value['trending']['videos']['algorithms']['enabled']
    if (!Array.isArray(enabled)) return false

    return !!enabled.find((e: string) => e === algorithm)
  }

  getUserVideoQuota () {
    return this.form.value['user']['videoQuota']
  }

  isExportUsersEnabled () {
    return this.form.value['export']['users']['enabled'] === true
  }

  getDisabledExportUsersClass () {
    return { 'disabled-checkbox-extra': !this.isExportUsersEnabled() }
  }

  isSignupEnabled () {
    return this.form.value['signup']['enabled'] === true
  }

  getDisabledSignupClass () {
    return { 'disabled-checkbox-extra': !this.isSignupEnabled() }
  }

  isImportVideosHttpEnabled (): boolean {
    return this.form.value['import']['videos']['http']['enabled'] === true
  }

  importSynchronizationChecked () {
    return this.isImportVideosHttpEnabled() && this.form.value['import']['videoChannelSynchronization']['enabled']
  }

  hasUnlimitedSignup () {
    return this.form.value['signup']['limit'] === -1
  }

  isSearchIndexEnabled () {
    return this.form.value['search']['searchIndex']['enabled'] === true
  }

  getDisabledSearchIndexClass () {
    return { 'disabled-checkbox-extra': !this.isSearchIndexEnabled() }
  }

  // ---------------------------------------------------------------------------

  isTranscriptionEnabled () {
    return this.form.value['videoTranscription']['enabled'] === true
  }

  getTranscriptionRunnerDisabledClass () {
    return { 'disabled-checkbox-extra': !this.isTranscriptionEnabled() }
  }

  // ---------------------------------------------------------------------------

  isAutoFollowIndexEnabled () {
    return this.form.value['followings']['instance']['autoFollowIndex']['enabled'] === true
  }

  buildLandingPageOptions () {
    let links: { label: string, path: string }[] = []

    if (this.serverConfig.homepage.enabled) {
      links.push({ label: $localize`Home`, path: '/home' })
    }

    links = links.concat([
      { label: $localize`Discover`, path: '/videos/overview' },
      { label: $localize`Browse videos`, path: '/videos/browse' }
    ])

    this.defaultLandingPageOptions = links.map(o => ({
      id: o.path,
      label: o.label,
      description: o.path
    }))
  }

  private checkImportSyncField () {
    const importSyncControl = this.form.get('import.videoChannelSynchronization.enabled')
    const importVideosHttpControl = this.form.get('import.videos.http.enabled')

    importVideosHttpControl.valueChanges
      .subscribe((httpImportEnabled) => {
        importSyncControl.setValue(httpImportEnabled && importSyncControl.value)
        if (httpImportEnabled) {
          importSyncControl.enable()
        } else {
          importSyncControl.disable()
        }
      })
  }

  private checkSignupField () {
    const signupControl = this.form.get('signup.enabled')

    signupControl.valueChanges
      .pipe(pairwise())
      .subscribe(([ oldValue, newValue ]) => {
        if (oldValue === false && newValue === true) {
          /* eslint-disable max-len */
          this.signupAlertMessage = $localize`You enabled signup: we automatically enabled the "Block new videos automatically" checkbox of the "Videos" section just below.`

          this.form.patchValue({
            autoBlacklist: {
              videos: {
                ofUsers: {
                  enabled: true
                }
              }
            }
          })
        }
      })

    signupControl.updateValueAndValidity()
  }
}
