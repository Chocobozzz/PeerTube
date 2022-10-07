import { Component, OnInit } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { Router } from '@angular/router'
import { AuthService, Notifier, User } from '@app/core'
import { USER_EXISTING_PASSWORD_VALIDATOR, USER_OTP_TOKEN_VALIDATOR } from '@app/shared/form-validators/user-validators'
import { FormReactiveService } from '@app/shared/shared-forms'
import { TwoFactorService } from '@app/shared/shared-users'

@Component({
  selector: 'my-account-two-factor',
  templateUrl: './my-account-two-factor.component.html',
  styleUrls: [ './my-account-two-factor.component.scss' ]
})
export class MyAccountTwoFactorComponent implements OnInit {
  twoFactorAlreadyEnabled: boolean

  step: 'request' | 'confirm' | 'confirmed' = 'request'

  twoFactorSecret: string
  twoFactorURI: string

  inPasswordStep = true

  formPassword: FormGroup
  formErrorsPassword: any

  formOTP: FormGroup
  formErrorsOTP: any

  private user: User
  private requestToken: string

  constructor (
    private notifier: Notifier,
    private twoFactorService: TwoFactorService,
    private formReactiveService: FormReactiveService,
    private auth: AuthService,
    private router: Router
  ) {
  }

  ngOnInit () {
    this.buildPasswordForm()
    this.buildOTPForm()

    this.auth.userInformationLoaded.subscribe(() => {
      this.user = this.auth.getUser()

      this.twoFactorAlreadyEnabled = this.user.twoFactorEnabled
    })
  }

  requestTwoFactor () {
    this.twoFactorService.requestTwoFactor({
      userId: this.user.id,
      currentPassword: this.formPassword.value['current-password']
    }).subscribe({
      next: ({ otpRequest }) => {
        this.requestToken = otpRequest.requestToken
        this.twoFactorURI = otpRequest.uri
        this.twoFactorSecret = otpRequest.secret.replace(/(.{4})/g, '$1 ').trim()

        this.step = 'confirm'
      },

      error: err => this.notifier.error(err.message)
    })
  }

  confirmTwoFactor () {
    this.twoFactorService.confirmTwoFactorRequest({
      userId: this.user.id,
      requestToken: this.requestToken,
      otpToken: this.formOTP.value['otp-token']
    }).subscribe({
      next: () => {
        this.notifier.success($localize`Two factor authentication has been enabled.`)

        this.auth.refreshUserInformation()

        this.router.navigateByUrl('/my-account/settings')
      },

      error: err => this.notifier.error(err.message)
    })
  }

  private buildPasswordForm () {
    const { form, formErrors } = this.formReactiveService.buildForm({
      'current-password': USER_EXISTING_PASSWORD_VALIDATOR
    })

    this.formPassword = form
    this.formErrorsPassword = formErrors
  }

  private buildOTPForm () {
    const { form, formErrors } = this.formReactiveService.buildForm({
      'otp-token': USER_OTP_TOKEN_VALIDATOR
    })

    this.formOTP = form
    this.formErrorsOTP = formErrors
  }
}
