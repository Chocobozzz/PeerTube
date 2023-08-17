import { pairwise } from 'rxjs/operators'
import { SelectOptionsItem } from 'src/types/select-options-item.model'
import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { MenuService, ThemeService } from '@app/core'
import { HTMLServerConfig } from '@peertube/peertube-models'
import { ConfigService } from '../shared/config.service'

@Component({
  selector: 'my-edit-basic-configuration',
  templateUrl: './edit-basic-configuration.component.html',
  styleUrls: [ './edit-custom-config.component.scss' ]
})
export class EditBasicConfigurationComponent implements OnInit, OnChanges {
  @Input() form: FormGroup
  @Input() formErrors: any

  @Input() serverConfig: HTMLServerConfig

  signupAlertMessage: string
  defaultLandingPageOptions: SelectOptionsItem[] = []
  availableThemes: SelectOptionsItem[]

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
