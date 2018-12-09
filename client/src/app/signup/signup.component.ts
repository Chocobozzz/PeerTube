import { Component, OnInit } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { UserCreate } from '../../../../shared'
import { FormReactive, UserService, UserValidatorsService } from '../shared'
import { AuthService, RedirectService, ServerService } from '@app/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'

@Component({
  selector: 'my-signup',
  templateUrl: './signup.component.html',
  styleUrls: [ './signup.component.scss' ]
})
export class SignupComponent extends FormReactive implements OnInit {
  info: string = null
  error: string = null
  signupDone = false

  constructor (
    protected formValidatorService: FormValidatorService,
    private authService: AuthService,
    private userValidatorsService: UserValidatorsService,
    private notificationsService: NotificationsService,
    private userService: UserService,
    private serverService: ServerService,
    private redirectService: RedirectService,
    private i18n: I18n
  ) {
    super()
  }

  get instanceHost () {
    return window.location.host
  }

  get requiresEmailVerification () {
    return this.serverService.getConfig().signup.requiresEmailVerification
  }

  ngOnInit () {
    this.buildForm({
      username: this.userValidatorsService.USER_USERNAME,
      password: this.userValidatorsService.USER_PASSWORD,
      email: this.userValidatorsService.USER_EMAIL,
      terms: this.userValidatorsService.USER_TERMS
    })
  }

  signup () {
    this.error = null

    const userCreate: UserCreate = this.form.value

    this.userService.signup(userCreate).subscribe(
      () => {
        this.signupDone = true

        if (this.requiresEmailVerification) {
          this.info = this.i18n('Welcome! Now please check your emails to verify your account and complete signup.')
          return
        }

        // Auto login
        this.authService.login(userCreate.username, userCreate.password)
            .subscribe(
              () => {
                this.notificationsService.success(
                  this.i18n('Success'),
                  this.i18n('You are now logged in as {{username}}!', { username: userCreate.username })
                )

                this.redirectService.redirectToHomepage()
              },

              err => this.error = err.message
            )
      },

      err => this.error = err.message
    )
  }
}
