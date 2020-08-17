import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { Notifier, UserService } from '@app/core'
import { RESET_PASSWORD_CONFIRM_VALIDATOR } from '@app/shared/form-validators/reset-password-validators'
import { USER_PASSWORD_VALIDATOR } from '@app/shared/form-validators/user-validators'
import { FormReactive, FormValidatorService } from '@app/shared/shared-forms'

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
    private userService: UserService,
    private notifier: Notifier,
    private router: Router,
    private route: ActivatedRoute
    ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      password: USER_PASSWORD_VALIDATOR,
      'password-confirm': RESET_PASSWORD_CONFIRM_VALIDATOR
    })

    this.userId = this.route.snapshot.queryParams['userId']
    this.verificationString = this.route.snapshot.queryParams['verificationString']

    if (!this.userId || !this.verificationString) {
      this.notifier.error($localize`Unable to find user id or verification string.`)
      this.router.navigate([ '/' ])
    }
  }

  resetPassword () {
    this.userService.resetPassword(this.userId, this.verificationString, this.form.value.password)
      .subscribe(
        () => {
          this.notifier.success($localize`Your password has been successfully reset!`)
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
