import { Component, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { ServerService } from '@app/core/server'
import { NotificationsService } from 'angular2-notifications'
import { UserCreate } from '../../../../shared'
import { FormReactive, UserService, UserValidatorsService } from '../shared'
import { RedirectService } from '@app/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'

@Component({
  selector: 'my-signup',
  templateUrl: './signup.component.html',
  styleUrls: [ './signup.component.scss' ]
})
export class SignupComponent extends FormReactive implements OnInit {
  error: string = null
  quotaHelpIndication = ''

  constructor (
    protected formValidatorService: FormValidatorService,
    private userValidatorsService: UserValidatorsService,
    private router: Router,
    private notificationsService: NotificationsService,
    private userService: UserService,
    private redirectService: RedirectService,
    private serverService: ServerService,
    private i18n: I18n
  ) {
    super()
  }

  get initialUserVideoQuota () {
    return this.serverService.getConfig().user.videoQuota
  }

  get instanceHost () {
    return window.location.host
  }

  ngOnInit () {
    this.buildForm({
      username: this.userValidatorsService.USER_USERNAME,
      password: this.userValidatorsService.USER_PASSWORD,
      email: this.userValidatorsService.USER_EMAIL,
      terms: this.userValidatorsService.USER_TERMS
    })

    this.serverService.configLoaded
      .subscribe(() => this.buildQuotaHelpIndication())
  }

  signup () {
    this.error = null

    const userCreate: UserCreate = this.form.value

    this.userService.signup(userCreate).subscribe(
      () => {
        this.notificationsService.success(
          this.i18n('Success'),
          this.i18n('Registration for {{username}} complete.', { username: userCreate.username })
        )
        this.redirectService.redirectToHomepage()
      },

      err => this.error = err.message
    )
  }

  private getApproximateTime (seconds: number) {
    const hours = Math.floor(seconds / 3600)
    let pluralSuffix = ''
    if (hours > 1) pluralSuffix = 's'
    if (hours > 0) return `~ ${hours} hour${pluralSuffix}`

    const minutes = Math.floor(seconds % 3600 / 60)
    if (minutes > 1) pluralSuffix = 's'

    return this.i18n('~ {{minutes}} {minutes, plural, =1 {minute} other {minutes}}', { minutes })
  }

  private buildQuotaHelpIndication () {
    if (this.initialUserVideoQuota === -1) return

    const initialUserVideoQuotaBit = this.initialUserVideoQuota * 8

    // 1080p: ~ 6Mbps
    // 720p: ~ 4Mbps
    // 360p: ~ 1.5Mbps
    const fullHdSeconds = initialUserVideoQuotaBit / (6 * 1000 * 1000)
    const hdSeconds = initialUserVideoQuotaBit / (4 * 1000 * 1000)
    const normalSeconds = initialUserVideoQuotaBit / (1.5 * 1000 * 1000)

    const lines = [
      this.i18n('{{seconds}} of full HD videos', { seconds: this.getApproximateTime(fullHdSeconds) }),
      this.i18n('{{seconds}} of HD videos', { seconds: this.getApproximateTime(hdSeconds) }),
      this.i18n('{{seconds}} of average quality videos', { seconds: this.getApproximateTime(normalSeconds) })
    ]

    this.quotaHelpIndication = lines.join('<br />')
  }
}
