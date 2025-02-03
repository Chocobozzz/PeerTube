import { NgClass, NgFor, NgIf, NgTemplateOutlet } from '@angular/common'
import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { AuthService, Notifier, RedirectService, SessionStorageService, UserService } from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { LOGIN_PASSWORD_VALIDATOR, LOGIN_USERNAME_VALIDATOR } from '@app/shared/form-validators/login-validators'
import { USER_OTP_TOKEN_VALIDATOR } from '@app/shared/form-validators/user-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { InputTextComponent } from '@app/shared/shared-forms/input-text.component'
import { InstanceAboutAccordionComponent } from '@app/shared/shared-instance/instance-about-accordion.component'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { NgbAccordionDirective, NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { getExternalAuthHref } from '@peertube/peertube-core-utils'
import { RegisteredExternalAuthConfig, ServerConfig, ServerErrorCode } from '@peertube/peertube-models'
import { environment } from 'src/environments/environment'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { InstanceBannerComponent } from '../shared/shared-instance/instance-banner.component'
import { AutofocusDirective } from '../shared/shared-main/common/autofocus.directive'
import { PluginSelectorDirective } from '../shared/shared-main/plugins/plugin-selector.directive'

@Component({
  selector: 'my-login',
  templateUrl: './login.component.html',
  styleUrls: [ './login.component.scss' ],
  imports: [
    NgIf,
    RouterLink,
    FormsModule,
    PluginSelectorDirective,
    ReactiveFormsModule,
    AutofocusDirective,
    NgClass,
    NgTemplateOutlet,
    InputTextComponent,
    NgFor,
    InstanceBannerComponent,
    InstanceAboutAccordionComponent,
    GlobalIconComponent,
    AlertComponent
  ]
})

export class LoginComponent extends FormReactive implements OnInit, AfterViewInit {
  private static SESSION_STORAGE_REDIRECT_URL_KEY = 'login-previous-url'

  @ViewChild('forgotPasswordModal', { static: true }) forgotPasswordModal: ElementRef
  @ViewChild('otpTokenInput') otpTokenInput: InputTextComponent
  @ViewChild('instanceAboutAccordion') instanceAboutAccordion: InstanceAboutAccordionComponent

  accordion: NgbAccordionDirective
  error: string = null
  forgotPasswordEmail = ''

  isAuthenticatedWithExternalAuth = false
  externalAuthError = false
  externalLogins: string[] = []

  instanceBannerUrl: string

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

    if (this.instanceAboutAccordion) {
      this.instanceAboutAccordion.expandTerms()
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
      'username': LOGIN_USERNAME_VALIDATOR,
      'password': LOGIN_PASSWORD_VALIDATOR,
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

  hasExternalLogins () {
    return this.getExternalLogins().length !== 0
  }

  getAuthHref (auth: RegisteredExternalAuthConfig) {
    return getExternalAuthHref(environment.apiUrl, auth)
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

    if (err.message.includes('credentials are invalid')) {
      this.error = $localize`Incorrect username or password.`
      return
    }

    if (err.message.includes('blocked')) {
      this.error = $localize`Your account is blocked.`
      return
    }

    if (err.body?.code === ServerErrorCode.ACCOUNT_WAITING_FOR_APPROVAL) {
      this.error = $localize`This account is awaiting approval by moderators.`
      return
    }

    if (err.body?.code === ServerErrorCode.ACCOUNT_APPROVAL_REJECTED) {
      this.error = $localize`Registration approval has been rejected for this account.`
      return
    }

    this.error = err.message
  }
}
