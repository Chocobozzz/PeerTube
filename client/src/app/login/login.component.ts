import { Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { RedirectService, ServerService } from '@app/core'
import { UserService } from '@app/shared'
import { NotificationsService } from 'angular2-notifications'
import { AuthService } from '../core'
import { FormReactive } from '../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { LoginValidatorsService } from '@app/shared/forms/form-validators/login-validators.service'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'

@Component({
  selector: 'my-login',
  templateUrl: './login.component.html',
  styleUrls: [ './login.component.scss' ]
})

export class LoginComponent extends FormReactive implements OnInit {
  @ViewChild('forgotPasswordModal') forgotPasswordModal: ElementRef
  @ViewChild('forgotPasswordEmailInput') forgotPasswordEmailInput: ElementRef

  error: string = null
  forgotPasswordEmail = ''

  private openedForgotPasswordModal: NgbModalRef

  constructor (
    protected formValidatorService: FormValidatorService,
    private modalService: NgbModal,
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

        err => {
          if (err.message.indexOf('credentials are invalid') !== -1) this.error = this.i18n('Incorrect username or password.')
          else if (err.message.indexOf('blocked') !== -1) this.error = this.i18n('You account is blocked.')
          else this.error = err.message
        }
      )
  }

  askResetPassword () {
    this.userService.askResetPassword(this.forgotPasswordEmail)
      .subscribe(
        () => {
          const message = this.i18n(
            'An email with the reset password instructions will be sent to {{email}}.',
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
    this.openedForgotPasswordModal = this.modalService.open(this.forgotPasswordModal)
  }

  hideForgotPasswordModal () {
    this.openedForgotPasswordModal.close()
  }
}
