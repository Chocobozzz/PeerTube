import { environment } from 'src/environments/environment'
import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AuthService, Notifier, RedirectService, UserService } from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { FormReactive, FormValidatorService, LoginValidatorsService } from '@app/shared/shared-forms'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { RegisteredExternalAuthConfig, ServerConfig } from '@shared/models'

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
  externalAuthError = false
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
    private hooks: HooksService,
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

    if (snapshot.queryParams.externalAuthError) {
      this.externalAuthError = true
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

    this.hooks.runAction('action:login.init', 'login')
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
    else if (err.message.indexOf('blocked') !== -1) this.error = this.i18n('Your account is blocked.')
    else this.error = err.message
  }
}
