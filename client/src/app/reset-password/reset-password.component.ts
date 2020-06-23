import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { Notifier, UserService } from '@app/core'
import { FormReactive, FormValidatorService, ResetPasswordValidatorsService, UserValidatorsService } from '@app/shared/shared-forms'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-login',
  templateUrl: './reset-password.component.html',
  styleUrls: [ './reset-password.component.scss' ]
})

export class ResetPasswordComponent extends FormReactive implements OnInit {
  private userId: number
  private verificationString: string

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
