import { Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { RedirectService, ServerService } from '@app/core'
import { UserService } from '@app/shared'
import { NotificationsService } from 'angular2-notifications'
import { ModalDirective } from 'ngx-bootstrap/modal'
import { AuthService } from '../core'
import { FormReactive } from '../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { LoginValidatorsService } from '@app/shared/forms/form-validators/login-validators.service'

@Component({
  selector: 'my-login',
  templateUrl: './login.component.html',
  styleUrls: [ './login.component.scss' ]
})

export class LoginComponent extends FormReactive implements OnInit {
  @ViewChild('forgotPasswordModal') forgotPasswordModal: ModalDirective
  @ViewChild('forgotPasswordEmailInput') forgotPasswordEmailInput: ElementRef

  error: string = null
  forgotPasswordEmail = ''

  constructor (
    protected formValidatorService: FormValidatorService,
    private loginValidatorsService: LoginValidatorsService,
    private authService: AuthService,
    private userService: UserService,
    private serverService: ServerService,
    private redirectService: RedirectService,
    private notificationsService: NotificationsService,
    private i18n: I18n
  ) {
    super()
  }

  get signupAllowed () {
    return this.serverService.getConfig().signup.allowed === true
  }

  ngOnInit () {
    this.buildForm({
      username: this.loginValidatorsService.LOGIN_USERNAME,
      password: this.loginValidatorsService.LOGIN_PASSWORD
    })
  }

  login () {
    this.error = null

    const { username, password } = this.form.value

    this.authService.login(username, password)
      .subscribe(
        () => this.redirectService.redirectToHomepage(),

        err => this.error = err.message
      )
  }

  askResetPassword () {
    this.userService.askResetPassword(this.forgotPasswordEmail)
      .subscribe(
        res => {
          const message = this.i18n(
            'An email with the reset password instructions will be sent to {{ email }}.',
            { email: this.forgotPasswordEmail }
          )
          this.notificationsService.success(this.i18n('Success'), message)
          this.hideForgotPasswordModal()
        },

        err => this.notificationsService.error(this.i18n('Error'), err.message)
      )
  }

  onForgotPasswordModalShown () {
    this.forgotPasswordEmailInput.nativeElement.focus()
  }

  openForgotPasswordModal () {
    this.forgotPasswordModal.show()
  }

  hideForgotPasswordModal () {
    this.forgotPasswordModal.hide()
  }
}
