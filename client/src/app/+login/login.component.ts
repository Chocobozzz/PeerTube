import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, Notifier, RedirectService, SessionStorageService, UserService } from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { LOGIN_PASSWORD_VALIDATOR, LOGIN_USERNAME_VALIDATOR } from '@app/shared/form-validators/login-validators'
import { USER_OTP_TOKEN_VALIDATOR } from '@app/shared/form-validators/user-validators'
import { FormReactive, FormReactiveService, InputTextComponent } from '@app/shared/shared-forms'
import { InstanceAboutAccordionComponent } from '@app/shared/shared-instance'
import { NgbAccordion, NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { PluginsManager } from '@root-helpers/plugins-manager'
import { RegisteredExternalAuthConfig, ServerConfig } from '@shared/models'

@Component({
  selector: 'my-login',
  templateUrl: './login.component.html',
  styleUrls: [ './login.component.scss' ]
})

export class LoginComponent extends FormReactive implements OnInit, AfterViewInit {
  private static SESSION_STORAGE_REDIRECT_URL_KEY = 'login-previous-url'

  @ViewChild('forgotPasswordModal', { static: true }) forgotPasswordModal: ElementRef
  @ViewChild('otpTokenInput') otpTokenInput: InputTextComponent

  accordion: NgbAccordion
  error: string = null
  forgotPasswordEmail = ''

  isAuthenticatedWithExternalAuth = false
  externalAuthError = false
  externalLogins: string[] = []

  instanceInformationPanels = {
    terms: true,
    administrators: false,
    features: false,
    moderation: false,
    codeOfConduct: false
  }

  otpStep = false

  private openedForgotPasswordModal: NgbModalRef
  private serverConfig: ServerConfig

  constructor (
    protected formReactiveService: FormReactiveService,
    private route: ActivatedRoute,
    private modalService: NgbModal,
    private authService: AuthService,
    private userService: UserService,
    private redirectService: RedirectService,
    private notifier: Notifier,
    private hooks: HooksService,
    private storage: SessionStorageService,
    private router: Router
  ) {
    super()
  }

  get signupAllowed () {
    return this.serverConfig.signup.allowed === true
  }

  get instanceName () {
    return this.serverConfig.instance.name
  }

  onTermsClick (event: Event, instanceInformation: HTMLElement) {
    event.preventDefault()

    if (this.accordion) {
      this.accordion.expand('terms')
      instanceInformation.scrollIntoView({ behavior: 'smooth' })
    }
  }

  isEmailDisabled () {
    return this.serverConfig.email.enabled === false
  }

  ngOnInit () {
    const snapshot = this.route.snapshot

    // Avoid undefined errors when accessing form error properties
    this.buildForm({
      username: LOGIN_USERNAME_VALIDATOR,
      password: LOGIN_PASSWORD_VALIDATOR,
      'otp-token': {
        VALIDATORS: [], // Will be set dynamically
        MESSAGES: USER_OTP_TOKEN_VALIDATOR.MESSAGES
      }
    })

    this.serverConfig = snapshot.data.serverConfig

    if (snapshot.queryParams.externalAuthToken) {
      this.loadExternalAuthToken(snapshot.queryParams.username, snapshot.queryParams.externalAuthToken)
      return
    }

    if (snapshot.queryParams.externalAuthError) {
      this.externalAuthError = true
      return
    }

    const previousUrl = this.redirectService.getPreviousUrl()
    if (previousUrl && previousUrl !== '/') {
      this.storage.setItem(LoginComponent.SESSION_STORAGE_REDIRECT_URL_KEY, previousUrl)
    }
  }

  ngAfterViewInit () {
    this.hooks.runAction('action:login.init', 'login')
  }

  getExternalLogins () {
    return this.serverConfig.plugin.registeredExternalAuths
  }

  getAuthHref (auth: RegisteredExternalAuthConfig) {
    return PluginsManager.getExternalAuthHref(auth)
  }

  login () {
    this.error = null

    const options = {
      username: this.form.value['username'],
      password: this.form.value['password'],
      otpToken: this.form.value['otp-token']
    }

    this.authService.login(options)
      .pipe()
      .subscribe({
        next: () => this.redirectService.redirectToPreviousRoute(),

        error: err => {
          this.handleError(err)
        }
      })
  }

  askResetPassword () {
    this.userService.askResetPassword(this.forgotPasswordEmail)
      .subscribe({
        next: () => {
          const message = $localize`An email with the reset password instructions will be sent to ${this.forgotPasswordEmail}.
The link will expire within 1 hour.`

          this.notifier.success(message)
          this.hideForgotPasswordModal()
        },

        error: err => this.notifier.error(err.message)
      })
  }

  openForgotPasswordModal () {
    this.openedForgotPasswordModal = this.modalService.open(this.forgotPasswordModal)
  }

  hideForgotPasswordModal () {
    this.openedForgotPasswordModal.close()
  }

  onInstanceAboutAccordionInit (instanceAboutAccordion: InstanceAboutAccordionComponent) {
    this.accordion = instanceAboutAccordion.accordion
  }

  hasUsernameUppercase () {
    return this.form.value['username'].match(/[A-Z]/)
  }

  private loadExternalAuthToken (username: string, token: string) {
    this.isAuthenticatedWithExternalAuth = true

    this.authService.login({ username, password: null, token })
      .subscribe({
        next: () => {
          const redirectUrl = this.storage.getItem(LoginComponent.SESSION_STORAGE_REDIRECT_URL_KEY)
          if (redirectUrl) {
            this.storage.removeItem(LoginComponent.SESSION_STORAGE_REDIRECT_URL_KEY)
            return this.router.navigateByUrl(redirectUrl)
          }

          this.redirectService.redirectToLatestSessionRoute()
        },

        error: err => {
          this.handleError(err)
          this.isAuthenticatedWithExternalAuth = false
        }
      })
  }

  private handleError (err: any) {
    if (this.authService.isOTPMissingError(err)) {
      this.otpStep = true

      setTimeout(() => {
        this.form.get('otp-token').setValidators(USER_OTP_TOKEN_VALIDATOR.VALIDATORS)
        this.otpTokenInput.focus()
      })

      return
    }

    if (err.message.indexOf('credentials are invalid') !== -1) this.error = $localize`Incorrect username or password.`
    else if (err.message.indexOf('blocked') !== -1) this.error = $localize`Your account is blocked.`
    else this.error = err.message
  }
}
