import { Component, ElementRef, OnInit, ViewChild, AfterViewInit } from '@angular/core'
import { Notifier, RedirectService } from '@app/core'
import { UserService } from '@app/shared'
import { AuthService } from '../core'
import { FormReactive } from '../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { LoginValidatorsService } from '@app/shared/forms/form-validators/login-validators.service'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { ActivatedRoute } from '@angular/router'
import { ServerConfig, RegisteredExternalAuthConfig } from '@shared/models/server/server-config.model'
import { environment } from 'src/environments/environment'

@Component({
  selector: 'my-login',
  templateUrl: './login.component.html',
  styleUrls: [ './login.component.scss' ]
})

export class LoginComponent extends FormReactive implements OnInit, AfterViewInit {
  @ViewChild('usernameInput', { static: false }) usernameInput: ElementRef
  @ViewChild('forgotPasswordModal', { static: true }) forgotPasswordModal: ElementRef

  error: string = null
  forgotPasswordEmail = ''
  isAuthenticatedWithExternalAuth = false
  externalLogins: string[] = []

  private openedForgotPasswordModal: NgbModalRef
  private serverConfig: ServerConfig

  constructor (
    protected formValidatorService: FormValidatorService,
    private route: ActivatedRoute,
    private modalService: NgbModal,
    private loginValidatorsService: LoginValidatorsService,
    private authService: AuthService,
    private userService: UserService,
    private redirectService: RedirectService,
    private notifier: Notifier,
    private i18n: I18n
  ) {
    super()
  }

  get signupAllowed () {
    return this.serverConfig.signup.allowed === true
  }

  isEmailDisabled () {
    return this.serverConfig.email.enabled === false
  }

  ngOnInit () {
    const snapshot = this.route.snapshot

    this.serverConfig = snapshot.data.serverConfig

    if (snapshot.queryParams.externalAuthToken) {
      this.loadExternalAuthToken(snapshot.queryParams.username, snapshot.queryParams.externalAuthToken)
      return
    }

    this.buildForm({
      username: this.loginValidatorsService.LOGIN_USERNAME,
      password: this.loginValidatorsService.LOGIN_PASSWORD
    })
  }

  ngAfterViewInit () {
    if (this.usernameInput) {
      this.usernameInput.nativeElement.focus()
    }
  }

  getExternalLogins () {
    return this.serverConfig.plugin.registeredExternalAuths
  }

  getAuthHref (auth: RegisteredExternalAuthConfig) {
    return environment.apiUrl + `/plugins/${auth.name}/${auth.version}/auth/${auth.authName}`
  }

  login () {
    this.error = null

    const { username, password } = this.form.value

    this.authService.login(username, password)
      .subscribe(
        () => this.redirectService.redirectToPreviousRoute(),

        err => this.handleError(err)
      )
  }

  askResetPassword () {
    this.userService.askResetPassword(this.forgotPasswordEmail)
      .subscribe(
        () => {
          const message = this.i18n(
            'An email with the reset password instructions will be sent to {{email}}. The link will expire within 1 hour.',
            { email: this.forgotPasswordEmail }
          )
          this.notifier.success(message)
          this.hideForgotPasswordModal()
        },

        err => this.notifier.error(err.message)
      )
  }

  openForgotPasswordModal () {
    this.openedForgotPasswordModal = this.modalService.open(this.forgotPasswordModal)
  }

  hideForgotPasswordModal () {
    this.openedForgotPasswordModal.close()
  }

  private loadExternalAuthToken (username: string, token: string) {
    this.isAuthenticatedWithExternalAuth = true

    this.authService.login(username, null, token)
    .subscribe(
      () => this.redirectService.redirectToPreviousRoute(),

      err => {
        this.handleError(err)
        this.isAuthenticatedWithExternalAuth = false
      }
    )
  }

  private handleError (err: any) {
    if (err.message.indexOf('credentials are invalid') !== -1) this.error = this.i18n('Incorrect username or password.')
    else if (err.message.indexOf('blocked') !== -1) this.error = this.i18n('You account is blocked.')
    else this.error = err.message
  }
}
