import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { UserService, UserValidatorsService } from '@app/shared'
import { NotificationsService } from 'angular2-notifications'
import { AuthService } from '../core'
import { FormReactive } from '../shared'
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

  constructor (
    protected formValidatorService: FormValidatorService,
    private resetPasswordValidatorsService: ResetPasswordValidatorsService,
    private userValidatorsService: UserValidatorsService,
    private authService: AuthService,
    private userService: UserService,
    private notificationsService: NotificationsService,
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
      this.notificationsService.error(this.i18n('Error'), this.i18n('Unable to find user id or verification string.'))
      this.router.navigate([ '/' ])
    }
  }

  resetPassword () {
    this.userService.resetPassword(this.userId, this.verificationString, this.form.value.password)
      .subscribe(
        () => {
          this.notificationsService.success(this.i18n('Success'), this.i18n('Your password has been successfully reset!'))
          this.router.navigate([ '/login' ])
        },

        err => this.notificationsService.error('Error', err.message)
      )
  }

  isConfirmedPasswordValid () {
    const values = this.form.value
    return values.password === values['password-confirm']
  }
}
