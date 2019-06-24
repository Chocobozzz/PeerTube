import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { UserService, UserValidatorsService, FormReactive } from '@app/shared'
import { Notifier } from '@app/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { ResetPasswordValidatorsService } from '@app/shared/forms/form-validators/reset-password-validators.service'

@Component({
  selector: 'my-login',
  templateUrl: './reset-password.component.html',
  styleUrls: [ './reset-password.component.scss' ]
})

export class ResetPasswordComponent extends FormReactive implements OnInit {
  private userId: number
  private verificationString: string

  invalidVerifactionString: boolean;
  invalidUser: boolean;
  isLoading: boolean;

  constructor (
    protected formValidatorService: FormValidatorService,
    private resetPasswordValidatorsService: ResetPasswordValidatorsService,
    private userValidatorsService: UserValidatorsService,
    private userService: UserService,
    private notifier: Notifier,
    private router: Router,
    private route: ActivatedRoute,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.isLoading = true
    this.buildForm({
      password: this.userValidatorsService.USER_PASSWORD,
      'password-confirm': this.resetPasswordValidatorsService.RESET_PASSWORD_CONFIRM
    })

    this.userId = this.route.snapshot.queryParams['userId']
    this.verificationString = this.route.snapshot.queryParams['verificationString']

    if (!this.userId || !this.verificationString) {
      this.notifier.error(this.i18n('Unable to find user id or verification string.'))
      this.router.navigate([ '/' ])
    }

    this.userService.verifyResetPasswordLink(this.userId, this.verificationString).subscribe(
      resp => {
        this.isLoading = false
      },
      err => {
        if(err.status === 403) {
          this.invalidVerifactionString = true;
        } else if (err.status === 404) {
          this.invalidUser = true;
        } else {
          console.log(err)
        }
        this.isLoading = false
      }
    )
  }

  resetPassword () {
    this.userService.resetPassword(this.userId, this.verificationString, this.form.value.password)
      .subscribe(
        () => {
          this.notifier.success(this.i18n('Your password has been successfully reset!'))
          this.router.navigate([ '/login' ])
        },

        err => this.notifier.error(err.message)
      )
  }

  isConfirmedPasswordValid () {
    const values = this.form.value
    return values.password === values['password-confirm']
  }
}
