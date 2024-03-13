import { pairwise } from 'rxjs/operators'
import { SelectOptionsItem } from 'src/types/select-options-item.model'
import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core'
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { MenuService, ThemeService } from '@app/core'
import { HTMLServerConfig } from '@peertube/peertube-models'
import { ConfigService } from '../shared/config.service'
import { PeerTubeTemplateDirective } from '../../../shared/shared-main/angular/peertube-template.directive'
import { SelectOptionsComponent } from '../../../shared/shared-forms/select/select-options.component'
import { UserRealQuotaInfoComponent } from '../../shared/user-real-quota-info.component'
import { MarkdownTextareaComponent } from '../../../shared/shared-forms/markdown-textarea.component'
import { HelpComponent } from '../../../shared/shared-main/misc/help.component'
import { PeertubeCheckboxComponent } from '../../../shared/shared-forms/peertube-checkbox.component'
import { SelectCustomValueComponent } from '../../../shared/shared-forms/select/select-custom-value.component'
import { NgFor, NgIf, NgClass } from '@angular/common'
import { RouterLink } from '@angular/router'

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
    PeerTubeTemplateDirective
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
    private menuService: MenuService,
    private themeService: ThemeService
  ) {}

  ngOnInit () {
    this.buildLandingPageOptions()
    this.checkSignupField()
    this.checkImportSyncField()

    this.availableThemes = this.themeService.buildAvailableThemes()

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

  isAutoFollowIndexEnabled () {
    return this.form.value['followings']['instance']['autoFollowIndex']['enabled'] === true
  }

  buildLandingPageOptions () {
    this.defaultLandingPageOptions = this.menuService.buildCommonLinks(this.serverConfig)
      .links
      .map(o => ({
        id: o.path,
        label: o.label,
        description: o.path
      }))
  }

  getDefaultThemeLabel () {
    return this.themeService.getDefaultThemeLabel()
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
