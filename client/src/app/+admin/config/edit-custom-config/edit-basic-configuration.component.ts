
import { pairwise } from 'rxjs/operators'
import { Component, Input, OnInit } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { ServerConfig } from '@shared/models'
import { ConfigService } from '../shared/config.service'

@Component({
  selector: 'my-edit-basic-configuration',
  templateUrl: './edit-basic-configuration.component.html',
  styleUrls: [ './edit-custom-config.component.scss' ]
})
export class EditBasicConfigurationComponent implements OnInit {
  @Input() form: FormGroup
  @Input() formErrors: any

  @Input() serverConfig: ServerConfig

  signupAlertMessage: string

  constructor (
    private configService: ConfigService
  ) { }

  ngOnInit () {
    this.checkSignupField()
  }

  getVideoQuotaOptions () {
    return this.configService.videoQuotaOptions
  }

  getVideoQuotaDailyOptions () {
    return this.configService.videoQuotaDailyOptions
  }

  getAvailableThemes () {
    return this.serverConfig.theme.registered
      .map(t => t.name)
  }

  doesTrendingVideosAlgorithmsEnabledInclude (algorithm: string) {
    const enabled = this.form.value['trending']['videos']['algorithms']['enabled']
    if (!Array.isArray(enabled)) return false

    return !!enabled.find((e: string) => e === algorithm)
  }

  isSignupEnabled () {
    return this.form.value['signup']['enabled'] === true
  }

  getDisabledSignupClass () {
    return { 'disabled-checkbox-extra': !this.isSignupEnabled() }
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

  private checkSignupField () {
    const signupControl = this.form.get('signup.enabled')

    signupControl.valueChanges
      .pipe(pairwise())
      .subscribe(([ oldValue, newValue ]) => {
        if (oldValue !== true && newValue === true) {
          // tslint:disable:max-line-length
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
  }
}
